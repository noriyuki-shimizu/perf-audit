import type { Plugin } from '../types/plugin.ts';
import { formatSize } from '../utils/size.ts';

// Bundle analyzer plugin that provides detailed bundle insights
export const bundleAnalyzerPlugin: Plugin = {
  name: 'bundle-analyzer',
  version: '1.0.0',
  description: 'Provides detailed bundle analysis and recommendations',

  hooks: {
    afterBundleAnalysis: async (context, data) => {
      if (!data) return;

      const { bundles } = data;
      const insights: string[] = [];

      // Analyze large bundles
      const largeBundles = bundles.filter(b => b.size > 200 * 1024); // > 200KB
      if (largeBundles.length > 0) {
        insights.push(`🔍 Large bundles detected (${largeBundles.length}):`);
        largeBundles.forEach(bundle => {
          insights.push(`  • ${bundle.name}: ${formatSize(bundle.size)}`);
        });
        insights.push('  Consider code splitting or dynamic imports');
      }

      // Analyze small bundles (potential over-splitting)
      const smallBundles = bundles.filter(b => b.size < 5 * 1024 && !b.name.includes('runtime')); // < 5KB
      if (smallBundles.length > 5) {
        insights.push(`📦 Many small bundles detected (${smallBundles.length}):`);
        insights.push('  Consider merging some chunks to reduce HTTP overhead');
      }

      // Check for potential duplicates
      const duplicateChecks = checkPotentialDuplicates(bundles);
      if (duplicateChecks.length > 0) {
        insights.push('🔄 Potential duplicate dependencies:');
        duplicateChecks.forEach(check => {
          insights.push(`  • ${check}`);
        });
      }

      // Store insights for later use
      context.store.set('insights', insights);

      if (insights.length > 0) {
        context.logger.info('Bundle analysis insights generated');
      }
    },

    beforeReport: async (context, data) => {
      if (!data) return;

      const insights = context.store.get('insights') || [];
      if (insights.length > 0) {
        // Add insights to recommendations
        data.result.recommendations = [
          ...data.result.recommendations,
          ...insights,
        ];
      }
    },
  },
};

function checkPotentialDuplicates(bundles: Array<{ name: string; size: number; }>): string[] {
  const checks: string[] = [];

  // Simple heuristic: bundles with very similar sizes might contain duplicates
  for (let i = 0; i < bundles.length; i++) {
    for (let j = i + 1; j < bundles.length; j++) {
      const bundle1 = bundles[i];
      const bundle2 = bundles[j];

      // If bundles are within 10% size similarity and both > 20KB
      const sizeDiff = Math.abs(bundle1.size - bundle2.size);
      const avgSize = (bundle1.size + bundle2.size) / 2;
      const similarityThreshold = 0.1; // 10%

      if (
        avgSize > 20 * 1024
        && sizeDiff / avgSize < similarityThreshold
        && !bundle1.name.includes('chunk')
        && !bundle2.name.includes('chunk')
      ) {
        checks.push(
          `${bundle1.name} and ${bundle2.name} have similar sizes (${formatSize(bundle1.size)} vs ${
            formatSize(bundle2.size)
          })`,
        );
      }
    }
  }

  return checks;
}

export default bundleAnalyzerPlugin;
