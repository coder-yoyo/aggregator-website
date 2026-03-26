package com.example.aggregator.dto;

import java.util.List;

public record AggregatedResult(
        String title,
        String url,
        String snippet,
        double totalScore,
        int aggregatedRank,
        List<Appearance> appearances
) {}
