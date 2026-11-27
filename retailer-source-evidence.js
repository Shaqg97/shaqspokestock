(function (root) {
  "use strict";

  const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;
  const SOURCE_STATES = new Set(["in stock", "pre-order", "out of stock"]);
  const DISPLAY_STATES = {
    "in stock": "In Stock",
    "pre-order": "Pre-Order",
    "out of stock": "Sold Out"
  };

  function timestamp(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sydneyDate(value) {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || "";
    return part("year") + "-" + part("month") + "-" + part("day");
  }

  function observationKey(product, offer) {
    return [product.name, offer.name, offer.url].join("|");
  }

  function makeSourceNote(availability, checkedAt, sourcePrice, cataloguePrice) {
    const when = new Date(checkedAt).toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    });
    const state = DISPLAY_STATES[availability].toLowerCase();
    const hasSourcePrice = Number.isFinite(sourcePrice) && sourcePrice > 0 && sourcePrice < 5000;
    const hasCataloguePrice = Number.isFinite(cataloguePrice) && cataloguePrice > 0;
    if (!hasSourcePrice) {
      return "Direct retailer page checked " + when + " and showed " + state + "; the monitor did not capture a current price, so the displayed amount is only a catalogue reference.";
    }
    if (hasCataloguePrice && Math.abs(sourcePrice - cataloguePrice) > 0.01) {
      return "Direct retailer page checked " + when + " and showed " + state + "; its structured price was A$" + sourcePrice.toFixed(2) + " versus the A$" + cataloguePrice.toFixed(2) + " catalogue reference. Confirm the retailer's displayed sale and checkout price.";
    }
    return "Direct retailer page checked " + when + " and showed " + state + ". Confirm final checkout availability before ordering.";
  }

  function reconcileProducts(products, snapshot, now) {
    const currentTime = Number.isFinite(now) ? now : Date.now();
    const observations = new Map(
      (Array.isArray(snapshot?.observations) ? snapshot.observations : [])
        .filter(item => item && typeof item.key === "string")
        .map(item => [item.key, item])
    );

    return (Array.isArray(products) ? products : []).map(product => ({
      ...product,
      retailers: (Array.isArray(product.retailers) ? product.retailers : []).map(offer => {
        const observation = observations.get(observationKey(product, offer));
        if (!observation || observation.fetchStatus !== "ok") return { ...offer };

        const checkedAt = timestamp(observation.checkedAt);
        if (
          checkedAt === null ||
          checkedAt > currentTime + 5 * 60 * 1000 ||
          currentTime - checkedAt > MAX_SOURCE_AGE_MS
        ) return { ...offer };

        const availability = String(observation.availability || "").toLowerCase();
        if (!SOURCE_STATES.has(availability)) return { ...offer };

        // An online "out of stock" result cannot disprove a catalogue entry
        // explicitly labelled in-store-only; branch-level availability is unknown.
        if (
          availability === "out of stock" &&
          String(offer.stock || "").trim().toLowerCase() === "in store only"
        ) return { ...offer };

        const displayState = DISPLAY_STATES[availability];
        const sourcePrice = Number(observation.price);
        const hasSourcePrice = Number.isFinite(sourcePrice) && sourcePrice > 0 && sourcePrice < 5000;
        const cataloguePrice = Number(offer.price);
        const hasCataloguePrice = Number.isFinite(cataloguePrice) && cataloguePrice > 0;
        const priceMatches = hasSourcePrice && hasCataloguePrice && Math.abs(sourcePrice - cataloguePrice) <= 0.01;
        const stateMatches = String(offer.stock || "").trim().toLowerCase() === displayState.toLowerCase();
        const preserveVerified = stateMatches && offer.stockCheckStatus === "verified" && (!hasSourcePrice || priceMatches);
        const sourceNote = makeSourceNote(availability, observation.checkedAt, hasSourcePrice ? sourcePrice : null, hasCataloguePrice ? cataloguePrice : null);

        return {
          ...offer,
          stock: displayState,
          stockCheckStatus: preserveVerified ? offer.stockCheckStatus : "needs-review",
          checkedAt: preserveVerified ? offer.checkedAt : sydneyDate(observation.checkedAt),
          sourceCheckedAt: observation.checkedAt,
          sourceAvailability: availability,
          sourceObservedPrice: hasSourcePrice ? sourcePrice : null,
          sourceEvidenceStatus: "fresh-direct-page",
          sourceNote: preserveVerified && priceMatches ? "" : sourceNote
        };
      })
    }));
  }

  root.ShaqsRetailerEvidence = Object.freeze({ reconcileProducts });
})(typeof window !== "undefined" ? window : globalThis);
