// TypeScript declarations for Google Places web components

// Basic Google Maps API namespace declarations
declare global {
  namespace google {
  namespace maps {
    namespace event {
      function clearInstanceListeners(instance: any): void;
    }

    namespace places {
      interface PlaceResult {
        address_components?: any[];
        formatted_address?: string;
        geometry?: any;
        place_id?: string;
        [key: string]: any;
      }

      class Autocomplete {
        constructor(inputElement: HTMLInputElement, opts?: any);
        addListener(eventName: string, handler: () => void): void;
        getPlace(): PlaceResult;
        [key: string]: any;
      }
    }
  }
  }
}

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