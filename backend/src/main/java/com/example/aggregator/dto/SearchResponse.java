package com.example.aggregator.dto;

import java.util.List;
import java.util.Map;

public record SearchResponse(
        String query,
        long elapsedMs,
        List<EngineStatus> engines,
        List<AggregatedResult> aggregated,
        Map<String, List<SearchResultItem>> grouped
) {}
