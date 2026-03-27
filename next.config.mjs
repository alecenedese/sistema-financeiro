// Necessário para conexão direta ao PostgreSQL do Supabase (certificado self-signed)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
