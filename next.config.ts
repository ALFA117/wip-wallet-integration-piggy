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

  /**
   * Marcar el paquete como externo no basta: el rastreador de dependencias sigue
   * los `import`, y el binario `.node` entra por una ruta calculada en tiempo de
   * ejecución, así que nunca lo ve y no lo sube. Sin esto el despliegue compila
   * y luego revienta con ADDON_NOT_FOUND en la primera llamada a la billetera.
   */
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/sodium-native/prebuilds/**',
      './node_modules/sodium-native/*.node',
    ],
  },
}

export default nextConfig
