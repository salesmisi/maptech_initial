import { useEffect, useState } from 'react';

export interface BusinessDetails {
  company_name: string;
  logo_url: string;
}

const DEFAULT_DETAILS: BusinessDetails = {
  company_name: 'Maptech Information Solutions Inc.',
  logo_url: '/assets/Maptech-Official-Logo.png',
};

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
          setBusinessDetails({
            company_name: data?.company_name || DEFAULT_DETAILS.company_name,
            logo_url: data?.logo_url || DEFAULT_DETAILS.logo_url,
          });
        }
      } catch {
        // Keep defaults when request fails.
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return businessDetails;
}
