import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/bikebuddyCustomerAuth.css'
import './styles/customerPortalHome.css'
import './styles/admin-bikebuddy.css'
import './styles/shop-owner-auth.css'
import './styles/shop-portal.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
