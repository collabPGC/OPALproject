# OPAL Dashboard - React Implementation

This directory contains the React implementation of the OPAL Control Center dashboard.

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
react-dashboard/
├── src/
│   ├── components/          # Reusable components
│   │   ├── MetricCard.jsx
│   │   ├── SystemHealthCard.jsx
│   │   ├── WorkflowCard.jsx
│   │   └── ...
│   ├── screens/            # Screen components
│   │   ├── DashboardOverview.jsx
│   │   ├── DeviceMap.jsx
│   │   ├── MessageFlow.jsx
│   │   └── ...
│   ├── styles/             # Global styles
│   │   ├── design-system.css
│   │   └── ...
│   ├── hooks/              # Custom hooks
│   │   ├── useWebSocket.js
│   │   └── ...
│   └── App.jsx
├── package.json
└── README.md
```

## Design System

The dashboard uses the OPAL design system defined in `design-tokens.json`.

### Colors
- Primary Blue: `#2563EB`
- Primary Orange: `#F97316`
- Background: `#F3F4F6`
- Surface: `#FFFFFF`

### Typography
- Font Family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- H1: 32px, Bold
- H2: 24px, Bold
- Body: 14px, Regular

## Components

### MetricCard
Displays a single metric with icon and value.

```jsx
<MetricCard
  label="Devices Online"
  value="24/30"
  icon="🟢"
/>
```

### SystemHealthCard
Shows system health with progress bar.

```jsx
<SystemHealthCard
  health={80}
  statusItems={[
    "All systems operational",
    "2 devices offline (battery)"
  ]}
/>
```

### WorkflowCard
Displays active workflows.

```jsx
<WorkflowCard
  workflows={[
    {
      icon: "🚨",
      title: "Patient Blood Loss - Room 302",
      status: "Critical",
      badge: "critical"
    }
  ]}
/>
```

## Real-time Updates

The dashboard uses WebSocket for real-time updates.

```jsx
import { useWebSocket } from './hooks/useWebSocket';

const { data, connected } = useWebSocket('ws://localhost:8080');
```

## Responsive Design

The dashboard is responsive with breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: 1024px - 1440px
- Large: > 1440px

## Next Steps

1. Install dependencies: `npm install`
2. Set up WebSocket connection
3. Implement all screen components
4. Add real-time data updates
5. Test responsive design

