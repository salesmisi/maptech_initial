import { useEffect, useState } from 'react';

export interface BusinessDetails {
  company_name: string;
  logo_url: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  country?: string;
  address?: string;
  website?: string;
  vat_reg_tin?: string;
}

const DEFAULT_DETAILS: BusinessDetails = {
  company_name: 'Maptech Information Solutions Inc.',
  logo_url: '/assets/Maptech-Official-Logo.png',
};

function updateFavicon(url: string) {
  // Remove all existing icon link elements so the browser is forced to re-fetch.
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach(el => el.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = url.endsWith('.svg') ? 'image/svg+xml' : url.endsWith('.ico') ? 'image/x-icon' : 'image/png';
  link.href = url + '?v=' + Date.now();
  document.head.appendChild(link);
}

export function useBusinessDetails() {
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails>(DEFAULT_DETAILS);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/business-details', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const logoUrl = data?.logo_url || DEFAULT_DETAILS.logo_url;
          setBusinessDetails({
            company_name: data?.company_name || DEFAULT_DETAILS.company_name,
            logo_url: logoUrl,
            email: data?.email || undefined,
            phone: data?.phone || undefined,
            mobile_phone: data?.mobile_phone || undefined,
            country: data?.country || undefined,
            address: data?.address || undefined,
            website: data?.website || undefined,
            vat_reg_tin: data?.vat_reg_tin || undefined,
          });
          updateFavicon(logoUrl);
        }
      } catch {
        // Keep defaults when request fails.
      }
    };

    load();

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent<{ logo_url?: string }>).detail;
      if (detail?.logo_url) {
        updateFavicon(detail.logo_url);
      }
      load();
    };
    window.addEventListener('business-details-changed', handleChange);

    return () => {
      cancelled = true;
      window.removeEventListener('business-details-changed', handleChange);
    };
  }, []);

  return businessDetails;
}

