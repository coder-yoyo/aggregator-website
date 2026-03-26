package com.example.aggregator.dto;

public record EngineStatus(
        String engine,
        String status,
        String error,
        int count
) {}
