package com.example.aggregator.service;

import com.example.aggregator.dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SearchService {
    private static final Map<String, Double> SOURCE_WEIGHTS = Map.of(
            "bing", 1.0,
            "duckduckgo", 1.0,
            "wikipedia", 0.8
    );

    private static final String USER_AGENT = "Mozilla/5.0 AggregatorWebsite";
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<String> getEngines() {
        return List.of("bing", "duckduckgo", "wikipedia");
    }

    public SearchResponse search(String q, List<String> engines, int limit) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) throw new IllegalArgumentException("Query parameter q is required.");

        List<String> selected = engines == null || engines.isEmpty()
                ? getEngines()
                : engines.stream().map(String::toLowerCase).filter(getEngines()::contains).toList();

        if (selected.isEmpty()) throw new IllegalArgumentException("No valid engines selected.");

        long start = System.currentTimeMillis();
        List<CompletableFuture<EngineFetchResult>> futures = selected.stream()
                .map(engine -> CompletableFuture.supplyAsync(() -> fetchEngine(query, engine, limit)))
                .toList();

        List<EngineFetchResult> fetched = futures.stream().map(CompletableFuture::join).toList();
        Map<String, List<SearchResultItem>> grouped = new LinkedHashMap<>();
        List<EngineStatus> statuses = new ArrayList<>();

        for (EngineFetchResult result : fetched) {
            grouped.put(result.engine(), result.items());
            statuses.add(new EngineStatus(
                    result.engine(),
                    result.error() == null ? "ok" : "error",
                    result.error(),
                    result.items().size()
            ));
        }

        List<AggregatedResult> aggregated = aggregateAndRank(grouped);
        return new SearchResponse(query, System.currentTimeMillis() - start, statuses, aggregated, grouped);
    }

    private EngineFetchResult fetchEngine(String query, String engine, int limit) {
        try {
            List<SearchResultItem> items = switch (engine) {
                case "bing" -> searchBing(query, limit);
                case "duckduckgo" -> searchDuckDuckGo(query, limit);
                case "wikipedia" -> searchWikipedia(query, limit);
                default -> List.of();
            };
            return new EngineFetchResult(engine, items, null);
        } catch (Exception ex) {
            return new EngineFetchResult(engine, List.of(), ex.getMessage());
        }
    }

    List<AggregatedResult> aggregateAndRank(Map<String, List<SearchResultItem>> grouped) {
        Map<String, MutableAggregate> merged = new LinkedHashMap<>();

        for (Map.Entry<String, List<SearchResultItem>> entry : grouped.entrySet()) {
            String source = entry.getKey();
            double weight = SOURCE_WEIGHTS.getOrDefault(source, 1.0);

            for (SearchResultItem item : entry.getValue()) {
                String key = canonicalizeUrl(item.url());
                double score = computeScore(item.rank(), weight);
                MutableAggregate aggregate = merged.computeIfAbsent(key,
                        k -> new MutableAggregate(item.title(), item.url(), item.snippet(), 0.0, new ArrayList<>()));

                aggregate.totalScore += score;
                aggregate.appearances.add(new Appearance(source, item.rank(), score));
                if (item.snippet() != null && item.snippet().length() > Optional.ofNullable(aggregate.snippet).orElse("").length()) {
                    aggregate.snippet = item.snippet();
                }
            }
        }

        List<MutableAggregate> sorted = new ArrayList<>(merged.values());
        sorted.sort((a, b) -> {
            int cmp = Double.compare(b.totalScore, a.totalScore);
            return cmp != 0 ? cmp : a.title.compareToIgnoreCase(b.title);
        });

        List<AggregatedResult> results = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            MutableAggregate m = sorted.get(i);
            results.add(new AggregatedResult(m.title, m.url, m.snippet, round(m.totalScore), i + 1, m.appearances));
        }
        return results;
    }

    double computeScore(int rank, double weight) {
        int safeRank = Math.max(rank, 1);
        return round(weight * (1.0 / safeRank));
    }

    String canonicalizeUrl(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost() == null ? "" : uri.getHost().replaceFirst("^www\\.", "");
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (path.endsWith("/") && path.length() > 1) path = path.substring(0, path.length() - 1);
            return new URI(uri.getScheme(), uri.getUserInfo(), host, uri.getPort(), path, uri.getQuery(), null).toString();
        } catch (Exception e) {
            return url;
        }
    }

    private List<SearchResultItem> searchBing(String q, int limit) throws IOException, InterruptedException {
        String url = "https://www.bing.com/search?q=" + encode(q) + "&format=rss";
        String xml = getBody(url, "application/xml");

        Pattern itemPattern = Pattern.compile("<item>([\\s\\S]*?)</item>");
        Pattern titlePattern = Pattern.compile("<title><!\\[CDATA\\[(.*?)]]></title>|<title>(.*?)</title>");
        Pattern linkPattern = Pattern.compile("<link>(.*?)</link>");
        Pattern descPattern = Pattern.compile("<description><!\\[CDATA\\[(.*?)]]></description>|<description>(.*?)</description>");

        Matcher itemMatcher = itemPattern.matcher(xml);
        List<SearchResultItem> list = new ArrayList<>();
        while (itemMatcher.find() && list.size() < limit) {
            String item = itemMatcher.group(1);
            String title = firstMatch(item, titlePattern, 1, 2);
            String link = firstMatch(item, linkPattern, 1);
            String desc = firstMatch(item, descPattern, 1, 2);
            if (!title.isBlank() && !link.isBlank()) {
                list.add(new SearchResultItem(clean(title), clean(link), clean(desc), "bing", list.size() + 1));
            }
        }
        return list;
    }

    private List<SearchResultItem> searchDuckDuckGo(String q, int limit) throws IOException, InterruptedException {
        String url = "https://html.duckduckgo.com/html/?q=" + encode(q);
        String html = getBody(url, "text/html");

        Pattern blockPattern = Pattern.compile("<div class=\"result[\\s\\S]*?</div>\\s*</div>");
        Pattern linkPattern = Pattern.compile("<a[^>]*class=\"result__a\"[^>]*href=\"([^\"]+)\"[^>]*>([\\s\\S]*?)</a>");
        Pattern snippetPattern = Pattern.compile("result__snippet\"[^>]*>([\\s\\S]*?)</");

        Matcher blocks = blockPattern.matcher(html);
        List<SearchResultItem> list = new ArrayList<>();
        while (blocks.find() && list.size() < limit) {
            String block = blocks.group();
            Matcher l = linkPattern.matcher(block);
            if (!l.find()) continue;

            String rawHref = l.group(1);
            String resolved = rawHref;
            try {
                URI uri = URI.create(rawHref.startsWith("http") ? rawHref : "https://duckduckgo.com" + rawHref);
                String query = uri.getQuery() == null ? "" : uri.getQuery();
                for (String part : query.split("&")) {
                    if (part.startsWith("uddg=")) {
                        resolved = java.net.URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                    }
                }
            } catch (Exception ignored) {}

            Matcher s = snippetPattern.matcher(block);
            String snippet = s.find() ? s.group(1) : "";
            list.add(new SearchResultItem(clean(l.group(2)), clean(resolved), clean(snippet), "duckduckgo", list.size() + 1));
        }
        return list;
    }

    private List<SearchResultItem> searchWikipedia(String q, int limit) throws IOException, InterruptedException {
        String url = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=" +
                Math.min(limit, 20) + "&srsearch=" + encode(q);
        String json = getBody(url, "application/json");
        JsonNode root = objectMapper.readTree(json).path("query").path("search");

        List<SearchResultItem> list = new ArrayList<>();
        for (int i = 0; i < root.size() && i < limit; i++) {
            JsonNode item = root.get(i);
            String title = item.path("title").asText("");
            String snippet = item.path("snippet").asText("");
            String link = "https://en.wikipedia.org/wiki/" + encode(title.replace(' ', '_'));
            list.add(new SearchResultItem(clean(title), clean(link), clean(snippet), "wikipedia", i + 1));
        }
        return list;
    }

    private String getBody(String url, String accept) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent", USER_AGENT)
                .header("Accept", accept)
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("HTTP " + response.statusCode());
        }
        return response.body();
    }

    private String encode(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }

    private double round(double value) {
        return Math.round(value * 1_000_000d) / 1_000_000d;
    }

    private String clean(String text) {
        return text == null ? "" : text
                .replaceAll("<[^>]*>", " ")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String firstMatch(String input, Pattern p, int... groups) {
        Matcher m = p.matcher(input);
        if (!m.find()) return "";
        for (int group : groups) {
            String v = m.group(group);
            if (v != null) return v;
        }
        return "";
    }

    private record EngineFetchResult(String engine, List<SearchResultItem> items, String error) {}

    private static class MutableAggregate {
        String title;
        String url;
        String snippet;
        double totalScore;
        List<Appearance> appearances;

        MutableAggregate(String title, String url, String snippet, double totalScore, List<Appearance> appearances) {
            this.title = title;
            this.url = url;
            this.snippet = snippet;
            this.totalScore = totalScore;
            this.appearances = appearances;
        }
    }
}
