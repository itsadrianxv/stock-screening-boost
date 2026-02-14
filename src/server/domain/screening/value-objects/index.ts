/**
 * 值对象统一导出
 */
export {
  StockCode,
  StockMarket,
  InvalidStockCodeError,
  type StockCodeValidationResult,
} from "./stock-code";

export {
  // Types
  type IndicatorValue,
  type NumericValue,
  type TextValue,
  type ListValue,
  type RangeValue,
  type TimeSeriesValue,
  type IndicatorValueTypeTag,
  // Type guards
  isNumericValue,
  isTextValue,
  isListValue,
  isRangeValue,
  isTimeSeriesValue,
  // Factory functions
  createNumericValue,
  createTextValue,
  createListValue,
  createRangeValue,
  createTimeSeriesValue,
  // Serialization
  indicatorValueToDict,
  indicatorValueFromDict,
  indicatorValueEquals,
} from "./indicator-value";
