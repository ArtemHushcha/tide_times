# Configure Geocoder to use Nominatim (OpenStreetMap)
Geocoder.configure(
  # Geocoding options
  timeout: 3,                 # geocoding service timeout (secs)
  lookup: :nominatim,         # name of geocoding service (symbol)
  ip_lookup: :ipinfo_io,      # name of IP address geocoding service (symbol)
  language: :en,              # ISO-639 language code
  use_https: true,            # use HTTPS for lookup requests? (if supported)
  http_proxy: nil,            # HTTP proxy server (user:pass@host:port)
  https_proxy: nil,           # HTTPS proxy server (user:pass@host:port)
  api_key: nil,               # API key for geocoding service
  cache: nil,                 # cache object (must respond to #[], #[]=, and #del)
  cache_prefix: "geocoder:",  # prefix (string) to use for all cache keys

  # Exceptions that should not be rescued by default
  always_raise: [
    Geocoder::OverQueryLimitError,
    Geocoder::RequestDenied,
    Geocoder::InvalidRequest,
    Geocoder::InvalidApiKey
  ],

  # Calculation options
  units: :km,                 # :km for kilometers or :mi for miles
  distances: :linear          # :spherical or :linear
)

# Configure Nominatim specific settings
Geocoder::Configuration.instance_eval do
  @timeout = 10
  @lookup = :nominatim
  @http_headers = { "User-Agent" => "TideTimes App (your-email@example.com)" }
  @use_https = true
  @always_raise = [
    Geocoder::OverQueryLimitError,
    Geocoder::RequestDenied,
    Geocoder::InvalidRequest,
    Geocoder::InvalidApiKey
  ]
end

# Optional: Cache configuration
if Rails.env.production?
  Geocoder.configure(
    cache: Redis.new,
    cache_options: {
      expiration: 1.week, # Default expiration time for cached items
      prefix: "geocoder:"
    }
  )
end
