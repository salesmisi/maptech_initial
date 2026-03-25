import { Mail, Phone, Smartphone, MapPin, Globe } from 'lucide-react';
import { useBusinessDetails } from '../../hooks/useBusinessDetails';

interface BusinessFooterProps {
  isDark?: boolean;
}

export function BusinessFooter({ isDark = true }: BusinessFooterProps) {
  const businessDetails = useBusinessDetails();

  return (
    <div className={`relative z-10 mt-8 sm:mx-auto sm:w-full sm:max-w-md`}>
      <div className={`backdrop-blur-sm py-6 px-4 shadow sm:rounded-lg sm:px-6 border-t border-emerald-500/50 ${
        isDark
          ? 'bg-slate-950/70'
          : 'bg-white/80'
      }`}>
        <div className="space-y-4">
          {/* Company Name */}
          <div>
            <p className={`text-xs font-semibold tracking-wider uppercase ${
              isDark ? 'text-emerald-400/80' : 'text-emerald-700'
            }`}>
              Business Information
            </p>
            <h3 className={`text-lg font-bold mt-1 ${
              isDark ? 'text-slate-50' : 'text-slate-900'
            }`}>
              {businessDetails.company_name}
            </h3>
          </div>

          {/* Contact Information */}
          <div className="space-y-2 pt-2">
            {businessDetails.email && (
              <div className="flex items-start gap-3">
                <Mail className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <a
                  href={`mailto:${businessDetails.email}`}
                  className={`text-sm break-all hover:underline ${
                    isDark ? 'text-slate-300 hover:text-emerald-300' : 'text-slate-700 hover:text-emerald-700'
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
                    isDark ? 'text-slate-300 hover:text-emerald-300' : 'text-slate-700 hover:text-emerald-700'
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
                    isDark ? 'text-slate-300 hover:text-emerald-300' : 'text-slate-700 hover:text-emerald-700'
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
                  isDark ? 'text-slate-300' : 'text-slate-700'
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
                  isDark ? 'text-slate-300' : 'text-slate-700'
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
                  isDark ? 'text-slate-300' : 'text-slate-700'
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
                    isDark ? 'text-slate-300 hover:text-emerald-300' : 'text-slate-700 hover:text-emerald-700'
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
  );
}
