from unittest.mock import patch

from fastapi.testclient import TestClient

from app.gateway.common import build_cache_key, gateway_cache
from app.main import app
from app.policies.cache_policy import CachePolicy

client = TestClient(app)


def setup_function() -> None:
    gateway_cache.clear()


def test_get_v1_stock_evidence_batch_success():
    def fake_get_stock_evidence(*args, **kwargs):
        stock_code = kwargs.get("stock_code") or args[-2]
        concept = kwargs.get("concept")
        return {
            "stockCode": stock_code,
            "companyName": f"Company {stock_code}",
            "concept": concept or "AI",
            "evidenceSummary": "Test evidence summary",
            "catalysts": [],
            "risks": [],
            "credibilityScore": 70,
            "updatedAt": "2026-03-10T08:00:00+00:00",
        }

    with patch(
        "app.providers.akshare.client.AkShareProviderClient.get_stock_evidence",
        side_effect=fake_get_stock_evidence,
    ):
        response = client.post(
            "/api/v1/intelligence/stocks/evidence/batch",
            json={"stockCodes": ["603019", "300308"], "concept": "AI"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["data"]["items"]) == 2
    assert payload["data"]["errors"] == []


def test_intelligence_gateway_prefers_mock_fallback_over_stale_cache_when_provider_fails():
    cache_key = build_cache_key(
        dataset="theme_news",
        provider="akshare",
        params={"theme": "AI", "days": 7, "limit": 20},
    )
    gateway_cache.set(
        key=cache_key,
        value=[
            {
                "id": "stale-1",
                "title": "Stale cached headline",
                "summary": "Stale cached summary",
                "source": "cache",
                "publishedAt": "2026-03-01T08:00:00+00:00",
                "sentiment": "neutral",
                "relevanceScore": 0.4,
                "relatedStocks": [],
            }
        ],
        policy=CachePolicy(fresh_ttl_seconds=0, stale_ttl_seconds=120),
        as_of="2026-03-01T08:00:00+00:00",
    )

    with patch(
        "app.services.intelligence_data_adapter._fetch_theme_news_from_akshare",
        side_effect=Exception("provider down"),
    ):
        response = client.get("/api/v1/intelligence/themes/AI/news")

    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["cacheHit"] is False
    assert payload["meta"]["isStale"] is False
    assert payload["data"]["theme"] == "AI"
    assert payload["data"]["newsItems"][0]["source"] == "intelligence-fallback"
    assert payload["data"]["newsItems"][0]["id"] != "stale-1"
