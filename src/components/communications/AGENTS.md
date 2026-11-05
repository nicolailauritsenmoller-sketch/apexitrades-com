# Communications charts

- Movement alerts open the shared TradingViewChart in a conditionally mounted dialog using the existing pair-keyed candle and quote hooks; closing stops dialog-only subscriptions - why: reuse authoritative chart feeds without changing alert detection or navigating away from communications.
- The shared chart's opt-in movement preview selects an area graph and moving-average/volume overlays while hiding terminal tools; terminal defaults remain unchanged - why: reference-style previews reuse one chart engine without changing the trading screen.