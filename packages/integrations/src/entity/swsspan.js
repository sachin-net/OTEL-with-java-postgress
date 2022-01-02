/*
 * Internal representation of Span
 */

// TODO REMOVE - TEMP - KEPT FOR REFERENCE

import { pathOr } from 'ramda';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { hrTimeToMilliseconds } from '../utils/hrtime';

export class SwsSpan {
  public valid: boolean;
  public traceId: string | null;
  public spanId: string | null;
  public parentSpanId: string | null;
  public hasChild: boolean; // will be set to true upon trace completion if this span has child span(s)
  public depth: number | null;
  public name: string | null;
  public kind: string | null;
  public service: string | null;
  public status: any | null;
  public success: boolean;
  public startTime: number | null;
  public endTime: number | null;
  public duration: number | null;
  public attributes: any;
  public resourceAttributes: any;
  public instrumentationLibrary: string | null;

  constructor() {
    this.valid = false;
    this.traceId = null;
    this.spanId = null;
    this.parentSpanId = null;
    this.hasChild = false; // will be set to true upon trace completion if this span has child span(s)
    this.depth = null;
    this.name = null;
    this.kind = 'internal'; // default
    this.service = null;
    // status
    this.status = null;
    this.success = false; // true or false
    // timing
    this.startTime = null;
    this.endTime = null;
    this.duration = null;
    // attributes
    this.attributes = {};
    this.resourceAttributes = {};
    this.instrumentationLibrary = null;
  }

  // TODO Move to transforms
  // Convert attributes from array to object
  attributesToObject(attrs: any) {
    if (!Array.isArray(attrs) || attrs.length <= 0) {
      return {};
    }
    const attrsObj: any = {};
    attrs.map((x) => {
      const key = pathOr(null, ['key'], x);
      const vType: any = pathOr(null, ['value', 'value'], x);
      let value = null;
      switch (vType) {
        case 'string_value': {
          value = pathOr(null, ['value', 'string_value'], x);
          break;
        }
        case 'int_value': {
          value = parseInt(pathOr('0', ['value', 'int_value'], x));
          break;
        }
      }
      if (key && value) {
        attrsObj[key] = value;
      }
    });
    return attrsObj;
  }

  // TODO Move to transforms
  // Convert from Otel GRPC message
  fromOtel(msg: any) {
    // Can it be multiple ?
    const span = pathOr(null, ['instrumentation_library_spans', 0, 'spans', 0], msg);
    if (!span) {
      return this;
    }
    // @ts-ignore
    this.traceId = pathOr([], ['trace_id'], span).toString('hex') || null;
    // @ts-ignore
    this.spanId = pathOr([], ['span_id'], span).toString('hex') || null;
    // @ts-ignore
    this.parentSpanId = pathOr([], ['parent_span_id'], span).toString('hex') || null;
    this.valid = this.traceId !== null && this.spanId !== null;
    this.name = pathOr(null, ['name'], span);

    // Kind
    // https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/api.md#spankind
    const spanKind = pathOr(null, ['kind'], span);
    if (spanKind === 'SPAN_KIND_SERVER') {
      this.kind = 'server';
    } else if (spanKind === 'SPAN_KIND_CLIENT') {
      this.kind = 'client';
    } else if (spanKind === 'SPAN_KIND_PRODUCER') {
      this.kind = 'producer';
    } else if (spanKind === 'SPAN_KIND_CONSUMER') {
      this.kind = 'consumer';
    } else {
      this.kind = 'internal';
    }

    // Status
    this.status = pathOr({}, ['status'], span);
    const statusCode = pathOr(null, ['code'], this.status); // === 'STATUS_CODE_OK';
    const deprecatedStatusCode = pathOr(null, ['deprecated_code'], this.status);
    this.success = false;
    if (statusCode === 'STATUS_CODE_OK') {
      this.success = true;
    } else if (statusCode === 'STATUS_CODE_UNSET' && deprecatedStatusCode === 'DEPRECATED_STATUS_CODE_OK') {
      this.success = true;
    }

    // TODO Timing
    // Attributes
    this.attributes = this.attributesToObject(pathOr([], ['attributes'], span));

    // Resources
    this.resourceAttributes = this.attributesToObject(pathOr([], ['resource', 'attributes'], msg));
    this.service = pathOr(null, ['service.name'], this.resourceAttributes);

    // Instrumentation TODO Check
    this.instrumentationLibrary = pathOr(null, ['instrumentationLibrary', 'name'], span);

    return this;
  }

}
