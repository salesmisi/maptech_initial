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
            email: data?.email || undefined,
            phone: data?.phone || undefined,
            mobile_phone: data?.mobile_phone || undefined,
            country: data?.country || undefined,
            address: data?.address || undefined,
            website: data?.website || undefined,
            vat_reg_tin: data?.vat_reg_tin || undefined,
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

