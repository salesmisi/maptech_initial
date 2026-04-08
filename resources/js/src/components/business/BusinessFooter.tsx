import { useEffect, useRef, useState } from 'react';
import { Mail, Phone, Smartphone, MapPin, Globe, ChevronDown } from 'lucide-react';
import { useBusinessDetails } from '../../hooks/useBusinessDetails';

interface BusinessFooterProps {
  isDark?: boolean;
}

export function BusinessFooter({ isDark = true }: BusinessFooterProps) {
  const businessDetails = useBusinessDetails();
  const [isOpen, setIsOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;

    const updateHeight = () => {
      setContentHeight(contentRef.current?.scrollHeight ?? 0);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(contentRef.current);

    return () => observer.disconnect();
  }, [businessDetails]);

  return (
    <div className={`relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md`}>
      <div className={`backdrop-blur-md py-6 px-4 shadow-xl sm:rounded-lg sm:px-6 border-t border-emerald-500/60 ring-1 ${
        isDark
          ? 'bg-slate-950/85 ring-slate-800/80'
          : 'bg-white/95 ring-slate-300/70'
      }`}>
        <div aria-label="Business information">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="w-full text-left"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold tracking-wider uppercase ${
                  isDark ? 'text-emerald-400/80' : 'text-emerald-700'
                }`}>
                  Business Information
                </p>
                <h3 className={`text-base font-bold mt-1 ${
                  isDark ? 'text-slate-50' : 'text-slate-900'
                }`}>
                  {businessDetails.company_name}
                </h3>
              </div>
              <ChevronDown
                className={`mt-1 h-5 w-5 flex-shrink-0 transition-transform duration-500 ease-in-out ${
                  isOpen ? 'rotate-180' : 'rotate-0'
                } ${
                  isDark ? 'text-emerald-300' : 'text-emerald-700'
                }`}
              />
            </div>
          </button>

          <div
            className="overflow-hidden transition-[max-height] duration-500 ease-in-out"
            style={{ maxHeight: isOpen ? `${contentHeight}px` : '0px' }}
          >
            <div ref={contentRef}>
              <div className={`space-y-1.5 pt-3 transition-all duration-400 ease-in-out ${
                isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              }`}>
                {businessDetails.email && (
                  <div className="flex items-start gap-3">
                <Mail className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <a
                  href={`mailto:${businessDetails.email}`}
                  className={`text-sm break-all hover:underline ${
                    isDark ? 'text-slate-200 hover:text-emerald-200' : 'text-slate-800 hover:text-emerald-800'
                  }`}
                >
                  {businessDetails.email}
                </a>
              </div>
                )}

                {businessDetails.phone && (
                  <div className="flex items-start gap-3">
                <Phone className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <a
                  href={`tel:${businessDetails.phone}`}
                  className={`text-sm hover:underline ${
                    isDark ? 'text-slate-200 hover:text-emerald-200' : 'text-slate-800 hover:text-emerald-800'
                  }`}
                >
                  Telephone: {businessDetails.phone}
                </a>
              </div>
                )}

                {businessDetails.mobile_phone && (
                  <div className="flex items-start gap-3">
                <Smartphone className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <a
                  href={`tel:${businessDetails.mobile_phone}`}
                  className={`text-sm hover:underline ${
                    isDark ? 'text-slate-200 hover:text-emerald-200' : 'text-slate-800 hover:text-emerald-800'
                  }`}
                >
                  Mobile: {businessDetails.mobile_phone}
                </a>
              </div>
                )}

                {businessDetails.vat_reg_tin && (
                  <div className="flex items-start gap-3">
                <Globe className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <p className={`text-sm ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  VAT REG TIN No.: {businessDetails.vat_reg_tin}
                </p>
              </div>
                )}

                {businessDetails.address && (
                  <div className="flex items-start gap-3">
                <MapPin className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <p className={`text-sm ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {businessDetails.address}
                </p>
              </div>
                )}

                {businessDetails.country && (
                  <div className="flex items-start gap-3">
                <MapPin className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <p className={`text-sm ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {businessDetails.country}
                </p>
              </div>
                )}

                {businessDetails.website && (
                  <div className="flex items-start gap-3">
                <Globe className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <a
                  href={businessDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm break-all hover:underline ${
                    isDark ? 'text-slate-200 hover:text-emerald-200' : 'text-slate-800 hover:text-emerald-800'
                  }`}
                >
                  {businessDetails.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
