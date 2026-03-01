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

      class AutocompleteService {
        getPlacePredictions(
          request: any,
          callback?: (predictions: any[], status: any) => void
        ): Promise<{ predictions: any[] }>;
      }

      class PlacesService {
        constructor(attrContainer: any);
        getDetails(request: any, callback: (place: PlaceResult, status: any) => void): void;
      }

      enum PlacesServiceStatus {
        INVALID_REQUEST = 'INVALID_REQUEST',
        NOT_FOUND = 'NOT_FOUND',
        OK = 'OK',
        OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
        REQUEST_DENIED = 'REQUEST_DENIED',
        UNKNOWN_ERROR = 'UNKNOWN_ERROR',
        ZERO_RESULTS = 'ZERO_RESULTS'
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