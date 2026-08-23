import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * El SDK de WDK arrastra `sodium-native`, un addon nativo de C. El empaquetado
   * no puede resolverlo, así que se deja fuera del bundle y se carga en tiempo
   * de ejecución desde node_modules.
   */
  serverExternalPackages: [
    '@tetherto/wdk-wallet-evm',
    'sodium-native',
    'b4a',
    '@prisma/client',
    '@prisma/adapter-pg',
  ],
}

export default nextConfig
