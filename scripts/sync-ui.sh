#!/usr/bin/env bash
# The student app (apps/web) owns the design system. Copy it into apps/admin.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p apps/admin/components/ui
cp apps/web/components/ui/*.ts* apps/admin/components/ui/
cp apps/web/components/icons.tsx apps/web/components/providers.tsx apps/admin/components/
cp apps/web/lib/cn.ts apps/web/lib/motion.ts apps/web/lib/format.ts apps/web/lib/errors.ts apps/web/lib/database.types.ts apps/admin/lib/
cp apps/web/app/globals.css apps/admin/app/globals.css
echo "Design system synced to apps/admin."
