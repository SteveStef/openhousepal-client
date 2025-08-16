# EntryPoint™ Frontend

The frontend application for EntryPoint™ - The Ultimate Open House Lead Engine.

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Headless UI
- **State Management**: React hooks (useState, useEffect)

## Features

- 📱 **Mobile-first responsive design**
- 🔗 **Dynamic QR code routing**
- 📝 **Multi-step sign-in forms**
- 🎯 **Automated collection creation**
- 📧 **Email preference management**
- 🏠 **Property information display**

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy environment variables:
   ```bash
   cp .env.local.example .env.local
   ```

5. Update environment variables in `.env.local` as needed

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                          # Next.js App Router
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   ├── open-house/
│   │   └── [qr]/
│   │       └── page.tsx         # Dynamic QR code route
│   └── thank-you/
│       └── page.tsx             # Confirmation page
├── components/
│   └── OpenHouseSignInForm.tsx  # Main sign-in form
├── lib/
│   └── api.ts                   # API client utilities
├── types/
│   └── index.ts                 # TypeScript definitions
├── public/                      # Static assets
├── tailwind.config.js           # Tailwind configuration
├── next.config.js               # Next.js configuration
└── package.json
```

## Key Components

### OpenHouseSignInForm
Multi-step form component that:
- Collects visitor information
- Displays property details
- Offers collection sign-up
- Handles form validation and submission

### Dynamic Routing
- `/open-house/[qr]` - QR code specific sign-in pages
- Fetches property data based on QR code parameter
- Displays property-specific information

## API Integration

The frontend is designed to work with a Spring Boot backend. API calls are abstracted through:

- `lib/api.ts` - Centralized API client
- Type-safe interfaces in `types/index.ts`
- Error handling and loading states

## Styling

Uses Tailwind CSS with:
- Custom color palette (primary blues, success greens)
- Component classes for buttons and forms
- Responsive design utilities
- Mobile-first approach

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `EntryPoint™` |

## Development Notes

### Mock Data
Currently uses mock property data for development. Replace with actual API calls when backend is ready.

### Error Handling
Implements comprehensive error handling for:
- Network failures
- Invalid QR codes
- Form submission errors
- Property not found scenarios

### Performance
- Static generation for marketing pages
- Client-side navigation
- Optimized images and assets
- Minimal JavaScript bundles

## Future Enhancements

- [ ] Integration with Google Maps for property locations
- [ ] Image galleries for properties
- [ ] Push notifications for new properties
- [ ] Offline support with service workers
- [ ] Advanced form validation
- [ ] Multi-language support

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup
Ensure these environment variables are set in production:
- `NEXT_PUBLIC_API_URL` - Production API endpoint
- Any analytics or third-party service keys

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new files
3. Include proper error handling
4. Test on mobile devices
5. Update documentation as needed