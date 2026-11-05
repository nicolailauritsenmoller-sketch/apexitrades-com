# Communications charts

- Movement alerts open the shared TradingViewChart in a conditionally mounted dialog using the existing pair-keyed candle and quote hooks; closing stops dialog-only subscriptions - why: reuse authoritative chart feeds without changing alert detection or navigating away from communications.