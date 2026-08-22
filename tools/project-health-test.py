#!/usr/bin/env python3
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
errors=[]
manifest=json.loads((ROOT/'content/little-realm.project.json').read_text()); shared=json.loads((ROOT/'content/shared/content-library.json').read_text()); pack=json.loads((ROOT/'content/zones/starter-realm/world-pack.json').read_text()); src=(ROOT/'src/builder/project-health.js').read_text()
for label,obj,fmt in [('project',manifest,'little-realm-project'),('shared',shared,'little-realm-content-library'),('zone',pack,'little-realm-world-pack')]:
    if obj.get('schemaVersion')!=12: errors.append(f'{label} is not schema v12')
    if obj.get('format')!=fmt: errors.append(f'{label} format mismatch')
for token in ['DEV_PROJECT_SCHEMA_VERSION=12','DEV_SHARED_SCHEMA_VERSION=12','DEV_WORLD_SCHEMA_VERSION=12','developerRequireSchema','createDeveloperProjectSnapshot','validateDeveloperProject','developerProjectDirtyDetails']:
    if token not in src: errors.append(f'Project Health missing {token}')
for forbidden in ['migrateDeveloper','migrationSteps','schema v6 is supported']:
    if forbidden in src: errors.append(f'legacy migration path still present: {forbidden}')
if 'terrainDefaults' not in shared: errors.append('shared project missing terrain defaults')
if errors:
    print('Project Health check failed:'); [print('  - '+e) for e in errors]; raise SystemExit(1)
print('PASS strict schema-v12 project health + snapshots (no backward migration layer)')
