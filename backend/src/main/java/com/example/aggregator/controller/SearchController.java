package com.example.aggregator.controller;

import com.example.aggregator.dto.SearchResponse;
import com.example.aggregator.service.SearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class SearchController {
    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/engines")
    public Map<String, List<String>> engines() {
        return Map.of("engines", searchService.getEngines());
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam("q") String q,
            @RequestParam(value = "engines", required = false) String engines,
            @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        try {
            int safeLimit = Math.max(1, Math.min(limit, 25));
            List<String> selected = engines == null || engines.isBlank()
                    ? List.of()
                    : Arrays.stream(engines.split(",")).map(String::trim).filter(v -> !v.isBlank()).toList();
            SearchResponse response = searchService.search(q, selected, safeLimit);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }
}
