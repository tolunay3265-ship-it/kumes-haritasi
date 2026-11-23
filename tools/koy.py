# Köy/mahalle merkezlerini OpenStreetMap'ten (Overpass) alıp koy.json'a yazar
import json, urllib.request, urllib.parse, time, sys
B = (35.8, 25.5, 41.0, 34.6)  # güney, batı, kuzey, doğu (bnd.json'daki 17 il)
Q = '[out:json][timeout:180];node["place"~"^(village|hamlet|neighbourhood|quarter|suburb|town)$"](%s,%s,%s,%s);out;' % B
for u in ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']:
    for t in range(2):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'kumes-haritasi'}), timeout=300)
            j = json.load(r)
            el = [e for e in j.get('elements', []) if e.get('tags', {}).get('name')]
            if len(el) > 1000:
                out = [[e['tags'].get('name:tr') or e['tags']['name'], round(e['lat'], 5), round(e['lon'], 5)] for e in el]
                json.dump(out, open('koy.json', 'w'), ensure_ascii=False, separators=(',', ':'))
                print('ok', len(out), u); sys.exit(0)
            print('az', len(el), u)
        except Exception as ex:
            print('hata', u, ex)
        time.sleep(10)
sys.exit(1)
