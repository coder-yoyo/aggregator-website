package com.example.aggregator.service;

import com.example.aggregator.dto.AggregatedResult;
import com.example.aggregator.dto.SearchResultItem;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SearchServiceTest {
    private final SearchService searchService = new SearchService();

    @Test
    void computeScoreShouldDecreaseByRank() {
        assertEquals(1.0, searchService.computeScore(1, 1.0));
        assertEquals(0.5, searchService.computeScore(2, 1.0));
        assertEquals(0.8, searchService.computeScore(1, 0.8));
    }

    @Test
    void aggregateAndRankShouldMergeDuplicateUrls() {
        Map<String, List<SearchResultItem>> grouped = Map.of(
                "bing", List.of(
                        new SearchResultItem("A", "https://example.com/", "a", "bing", 1),
                        new SearchResultItem("B", "https://another.com", "b", "bing", 2)
                ),
                "duckduckgo", List.of(
                        new SearchResultItem("A2", "https://www.example.com", "better snippet", "duckduckgo", 3)
                )
        );

        List<AggregatedResult> result = searchService.aggregateAndRank(grouped);
        assertEquals(2, result.size());
        assertEquals("https://example.com/", result.get(0).url());
        assertEquals(2, result.get(0).appearances().size());
        assertEquals("better snippet", result.get(0).snippet());
        assertEquals(1, result.get(0).aggregatedRank());
    }
}
