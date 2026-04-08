import { describe, expect, it } from "vitest";
import { buildCatalogNotice } from "~/app/screening/screening-ui";

describe("buildCatalogNotice", () => {
  it("returns a danger notice when the catalog query fails", () => {
    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: "Python screening service error: 500",
        categories: [],
        items: [],
      }),
    ).toEqual({
      tone: "danger",
      description: "官方指标目录加载失败：Python screening service error: 500",
    });
  });

  it("returns an info notice when the catalog query succeeds but is empty", () => {
    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: null,
        categories: [],
        items: [],
      }),
    ).toEqual({
      tone: "info",
      description:
        "官方指标目录当前为空，请检查 Python 服务的指标目录接口是否正常。",
    });
  });

  it("returns null while loading or when catalog data is present", () => {
    expect(
      buildCatalogNotice({
        isLoading: true,
        errorMessage: null,
        categories: [],
        items: [],
      }),
    ).toBeNull();

    expect(
      buildCatalogNotice({
        isLoading: false,
        errorMessage: null,
        categories: [
          {
            id: "profitability",
            name: "盈利能力",
            indicatorCount: 1,
          },
        ],
        items: [
          {
            id: "roe",
            name: "ROE",
            categoryId: "profitability",
            valueType: "NUMBER",
            periodScope: "series",
            retrievalMode: "statement_series",
          },
        ],
      }),
    ).toBeNull();
  });
});
