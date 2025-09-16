// TypeScript declarations for Google Places web components

declare namespace JSX {
  interface IntrinsicElements {
    'gmp-place-autocomplete': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        types?: string
        country?: string
        fields?: string
        'restrict-to-country'?: string
      },
      HTMLElement
    >
  }
}

// Custom event types for Google Places web components
interface GMPPlaceSelectEvent extends CustomEvent {
  detail: {
    place: google.maps.places.PlaceResult
  }
}

declare global {
  interface HTMLElementEventMap {
    'gmp-placeselect': GMPPlaceSelectEvent
  }
}

export {}