import os
for root, dirs, files in os.walk('src/components'):
    dirs[:] = [d for d in dirs if d not in ('browse','channel-directory','player-modal') and not d.startswith('.')]
    for f in files:
        if f.endswith('.tsx') and f not in ('browse.tsx','channel-directory.tsx','player-modal.tsx'):
            if 'stream' in f or 'route' in f: continue
            p = os.path.join(root, f)
            try:
                txt = open(p, 'r', encoding='utf-8', errors='ignore').read()
            except: continue
            for i, line in enumerate(txt.splitlines(), 1):
                if 'href="/"' in line or "href='/'" in line:
                    if 'admin' in p: continue
                    print(p+':'+str(i)+':'+line.strip()[:140])
