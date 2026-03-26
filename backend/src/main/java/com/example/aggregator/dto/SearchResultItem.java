package com.example.aggregator.dto;

public record SearchResultItem(
        String title,
        String url,
        String snippet,
        String source,
        int rank
) {}
