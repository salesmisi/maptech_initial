import React, { useEffect, useRef, useState } from 'react';
import { Building2, ImagePlus, Save, Trash2, CheckCircle, AlertCircle, Mail, Phone, Smartphone, Globe, MapPin } from 'lucide-react';

interface BusinessDetailsResponse {
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

function getXsrfToken(): string {
  const v = `; ${document.cookie}`;
  const parts = v.split('; XSRF-TOKEN=');
  return parts.length === 2 ? decodeURIComponent(parts.pop()?.split(';').shift() || '') : '';
}

async function getCsrf() {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
}

export function BusinessDetails() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [vatRegTin, setVatRegTin] = useState('');
  const [logoUrl, setLogoUrl] = useState('/assets/Maptech-Official-Logo.png');
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/business-details', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('Failed to load business details');
        const data: BusinessDetailsResponse = await res.json();
        if (!cancelled) {
          setCompanyName(data.company_name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setMobilePhone(data.mobile_phone || '');
          setCountry(data.country || '');
          setAddress(data.address || '');
          setWebsite(data.website || '');
          setVatRegTin(data.vat_reg_tin || '');
          setLogoUrl(data.logo_url || '/assets/Maptech-Official-Logo.png');
        }
      } catch {
        if (!cancelled) {
          setMessage({ type: 'error', text: 'Failed to load business details.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSelectLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedLogo(file);
    setRemoveLogo(false);
    if (file) {
      const localPreview = URL.createObjectURL(file);
      setLogoUrl(localPreview);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await getCsrf();
      const form = new FormData();
      form.append('company_name', companyName.trim());
      form.append('email', email.trim());
      form.append('phone', phone.trim());
      form.append('mobile_phone', mobilePhone.trim());
      form.append('country', country.trim());
      form.append('address', address.trim());
      form.append('website', website.trim());
      form.append('vat_reg_tin', vatRegTin.trim());
      form.append('remove_logo', removeLogo ? '1' : '0');
      if (selectedLogo) {
        form.append('logo', selectedLogo);
      }

      const res = await fetch('/api/admin/business-details', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: form,
      });

      let data: any = null;
      const raw = await res.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { message: raw || 'Unexpected server response.' };
      }

      if (!res.ok) {
        const err = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message;
        throw new Error(err || 'Failed to save business details.');
      }

      setCompanyName(data.company_name || companyName);
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setMobilePhone(data.mobile_phone || '');
      setCountry(data.country || '');
      setAddress(data.address || '');
      setWebsite(data.website || '');
      setVatRegTin(data.vat_reg_tin || '');
      setLogoUrl(data.logo_url || '/assets/Maptech-Official-Logo.png');
      setSelectedLogo(null);
      setRemoveLogo(false);
      if (fileRef.current) fileRef.current.value = '';
      setMessage({ type: 'success', text: data?.message || 'Business details updated.' });
    } catch (err: any) {
      // Network-level failures surface as TypeError("Failed to fetch") in browsers.
      const text = String(err?.message || '').toLowerCase();
      const isNetwork = text.includes('failed to fetch') || text.includes('networkerror');
      setMessage({
        type: 'error',
        text: isNetwork
          ? 'Network error while saving. Please refresh and try again.'
          : (err?.message || 'Failed to save business details.'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-slate-600">Loading business details...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Business Details</h1>

      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50' : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50'}`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      <form onSubmit={onSave} className="bg-white dark:bg-slate-900/80 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Company Name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              maxLength={255}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="Enter company name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="contact@company.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Telephone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Mobile Phone Number
          </label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="tel"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              maxLength={20}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="+63 9xx xxx xxxx"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            VAT REG TIN No.
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={vatRegTin}
              onChange={(e) => setVatRegTin(e.target.value)}
              maxLength={100}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="000-000-000-000"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Country
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              maxLength={100}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="Philippines"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Address
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 py-2 text-slate-900 dark:text-slate-100"
              placeholder="123 Main Street, City, State 12345"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Website
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={255}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3 text-slate-900 dark:text-slate-100"
              placeholder="www.company.com or company.com"
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You can enter short formats. It will be saved as a full URL automatically.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Company Logo
          </label>

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="h-20 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-center overflow-hidden">
              <img src={logoUrl} alt="Company logo preview" className="max-h-16 max-w-24 object-contain" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ImagePlus className="h-4 w-4" />
                Upload Logo
              </button>

              <button
                type="button"
                onClick={() => {
                  setRemoveLogo(true);
                  setSelectedLogo(null);
                  setLogoUrl('/assets/Maptech-Official-Logo.png');
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 dark:border-red-800/60 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
                Reset to Default Logo
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                onChange={onSelectLogo}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">PNG, JPG, SVG, or WEBP. Max 2MB.</p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Business Details'}
          </button>
        </div>
      </form>
    </div>
  );
}
