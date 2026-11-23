/* Google Haritalar için küçük bir "Leaflet benzeri" köprü.
   Uygulamanın geri kalanı Leaflet ile yazıldı; Google anahtarı varsa bu dosya
   window.L'yi Google Maps üstünde çalışan aynı adlı parçalarla değiştirir. */
function installShim() {
  const GM = google.maps;
  class LatLng {
    constructor(lat, lng) { this.lat = +lat; this.lng = +lng; }
    toBounds(m) { const dLat = m / 2 / 111320, dLng = m / 2 / (111320 * Math.cos(this.lat * Math.PI / 180)); return new Bounds([this.lat - dLat, this.lng - dLng], [this.lat + dLat, this.lng + dLng]); }
  }
  const toLL = a => a instanceof LatLng ? a : Array.isArray(a) ? new LatLng(a[0], a[1]) : typeof a.lat === 'function' ? new LatLng(a.lat(), a.lng()) : new LatLng(a.lat, a.lng);
  const gl = a => { const l = toLL(a); return { lat: l.lat, lng: l.lng }; };
  class Bounds {
    constructor(sw, ne) { this.sw = toLL(sw); this.ne = toLL(ne); }
    pad(r) { const h = (this.ne.lat - this.sw.lat) * r, w = (this.ne.lng - this.sw.lng) * r; return new Bounds([this.sw.lat - h, this.sw.lng - w], [this.ne.lat + h, this.ne.lng + w]); }
    contains(p) { const l = toLL(p); return l.lat >= this.sw.lat && l.lat <= this.ne.lat && l.lng >= this.sw.lng && l.lng <= this.ne.lng; }
    getSouth() { return this.sw.lat; } getWest() { return this.sw.lng; } getNorth() { return this.ne.lat; } getEast() { return this.ne.lng; }
    g() { return { south: this.sw.lat, west: this.sw.lng, north: this.ne.lat, east: this.ne.lng }; }
  }
  const pt = (x, y) => ({ x, y, distanceTo(o) { return Math.hypot(this.x - o.x, this.y - o.y); } });

  // Olay yayıcı
  class Ev {
    on(n, f) { (this._h = this._h || {})[n] = (this._h[n] || []).concat(f); return this; }
    fire(n, e) { ((this._h || {})[n] || []).forEach(f => f(e || {})); }
  }
  // Katman tabanı: addTo(harita ya da grup), remove()
  class Layer extends Ev {
    addTo(t) { if (t instanceof Group) t.add(this); else this._show(t); return this; }
    _show(m) { this._map = m; this._attach(m.g); }
    _hide() { this._detach(); this._map = null; }
    remove() { if (this._group) this._group.del(this); this._hide(); }
  }
  class Group extends Layer {
    constructor() { super(); this.items = []; }
    add(l) { this.items.push(l); l._group = this; if (this._map) l._show(this._map); }
    del(l) { this.items = this.items.filter(x => x !== l); }
    _attach() { this.items.forEach(l => l._show(this._map)); }
    _detach() { this.items.forEach(l => l._hide()); }
    clearLayers() { this.items.forEach(l => { l._group = null; l._hide(); }); this.items = []; }
    eachLayer(f) { this.items.forEach(f); }
  }
  // HTML işaret (Leaflet divIcon karşılığı)
  class HtmlOv extends GM.OverlayView {
    constructor(owner) { super(); this.o = owner; }
    onAdd() {
      const o = this.o, d = document.createElement('div');
      d.style.cssText = 'position:absolute;' + (o.center ? 'transform:translate(-50%,-50%);' : 'transform:translate(-50%,-5px);width:max-content;');
      d.innerHTML = o.html; this.div = d;
      const pane = o.interactive ? this.getPanes().overlayMouseTarget : this.getPanes().overlayLayer;
      pane.appendChild(d);
      if (!o.interactive) { d.style.pointerEvents = 'none'; return; }
      d.style.cursor = 'pointer';
      d.addEventListener('click', ev => { ev.stopPropagation(); if (o._dragged) { o._dragged = false; return; } o.fire('click', { latlng: o.ll }); });
      d.addEventListener('dblclick', ev => { ev.stopPropagation(); o.fire('dblclick', {}); });
      d.addEventListener('pointerdown', ev => {
        if (!o.draggable) return; ev.stopPropagation(); ev.preventDefault(); o._map.g.setOptions({ gestureHandling: 'none' });
        const mv = e2 => { const r = o._map.g.getDiv().getBoundingClientRect(); o.ll = o._map.containerPointToLatLng([e2.clientX - r.left, e2.clientY - r.top]); o._dragged = true; this.draw(); };
        const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); o._map.g.setOptions({ gestureHandling: o._map._gh }); if (o._dragged) o.fire('dragend', {}); };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      });
      GM.OverlayView.preventMapHitsAndGesturesFrom(d);
    }
    draw() { const p = this.getProjection() && this.getProjection().fromLatLngToDivPixel(new GM.LatLng(this.o.ll.lat, this.o.ll.lng)); if (p && this.div) { this.div.style.left = p.x + 'px'; this.div.style.top = p.y + 'px'; } }
    onRemove() { if (this.div) this.div.remove(); this.div = null; }
  }
  class Marker extends Layer {
    constructor(ll, o) { super(); this.ll = toLL(ll); this.html = (o.icon && o.icon.html) || ''; this.interactive = o.interactive !== false; this.draggable = !!o.draggable; this.center = !!o._center; }
    _attach(g) { this.ov = new HtmlOv(this); this.ov.setMap(g); }
    _detach() { if (this.ov) this.ov.setMap(null); this.ov = null; }
    getLatLng() { return this.ll; }
  }
  const dash = (o, color) => o.dashArray ? { strokeOpacity: 0, icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, strokeWeight: o.weight || 3, scale: 2 }, offset: '0', repeat: (parseInt(o.dashArray, 10) * 2 || 12) + 'px' }] } : { strokeOpacity: o.opacity == null ? 1 : o.opacity };
  class Polyline extends Layer {
    constructor(pts, o) { super(); this.pts = pts; this.o = o || {}; }
    _attach(g) { const o = this.o, c = o.color || '#3388ff'; this.p = new GM.Polyline(Object.assign({ map: g, path: this.pts.map(gl), strokeColor: c, strokeWeight: o.weight || 3, strokeOpacity: o.opacity == null ? 1 : o.opacity, clickable: false, zIndex: o.zIndex || 50 }, dash(o, c))); }
    _detach() { if (this.p) this.p.setMap(null); this.p = null; }
    setLatLngs(pts) { this.pts = pts; if (this.p) this.p.setPath(pts.map(gl)); }
  }
  class Circle extends Layer {
    constructor(c, o) { super(); this.c = c; this.o = o || {}; }
    _attach(g) { const o = this.o; this.p = new GM.Circle({ map: g, center: gl(this.c), radius: o.radius, strokeColor: o.color, strokeWeight: o.weight || 2, fillColor: o.fillColor || o.color, fillOpacity: o.fillOpacity == null ? .2 : o.fillOpacity, clickable: false }); }
    _detach() { if (this.p) this.p.setMap(null); this.p = null; }
  }
  // Küçük daire işaret (Leaflet circleMarker): HTML nokta
  const circleMarker = (c, o) => { const r = o.radius || 6, m = new Marker(c, { interactive: false, icon: { html: '<div style="width:' + 2 * r + 'px;height:' + 2 * r + 'px;border-radius:50%;background:' + (o.fillColor || o.color) + ';border:' + (o.weight || 2) + 'px solid ' + (o.color || '#fff') + ';box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>' } }); m.center = true; return m; };
  // GeoJSON çokgenler (taranan alanlar, rota şeridi)
  class PolyFeat extends Layer {
    constructor(f, st, inter) { super(); this.feature = f; this.st = st; this.inter = inter; }
    _attach(g) {
      const geo = this.feature.geometry || this.feature, polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : [];
      const st = this.st;
      this.ps = polys.map(rings => { const p = new GM.Polygon({ map: g, paths: rings.map(r => r.map(c => ({ lat: c[1], lng: c[0] }))), strokeColor: st.color, strokeWeight: st.weight == null ? 2 : st.weight, fillColor: st.fillColor || st.color, fillOpacity: st.fillOpacity == null ? .2 : st.fillOpacity, clickable: this.inter, zIndex: 10 });
        if (this.inter) { p.addListener('click', e => this.fire('click', { latlng: toLL(e.latLng) })); p.addListener('dblclick', e => { if (e.stop) e.stop(); this.fire('dblclick', { latlng: toLL(e.latLng) }); }); } return p; });
    }
    _detach() { (this.ps || []).forEach(p => p.setMap(null)); this.ps = null; }
  }
  class GeoJSON extends Group {
    constructor(data, o) { super(); this.o = o || {}; if (data) this.addData(data); }
    addData(f) { this.add(new PolyFeat(f, this.o.style || {}, this.o.interactive !== false)); }
  }
  class MapW extends Ev {
    constructor(el, o) {
      super(); const div = typeof el === 'string' ? document.getElementById(el) : el;
      this._gh = 'greedy';
      this.g = new GM.Map(div, { center: { lat: 38.48, lng: 28.14 }, zoom: 11, mapTypeId: 'hybrid', disableDefaultUI: true, clickableIcons: true, disableDoubleClickZoom: true, gestureHandling: 'greedy', keyboardShortcuts: false, tilt: 0, rotateControl: false, maxZoom: 21 });
      const ov = new GM.OverlayView(); ov.onAdd = () => {}; ov.draw = () => {}; ov.setMap(this.g); this._ov = ov;
      const self = this;
      this.dragging = { enable() { self._gh = 'greedy'; self.g.setOptions({ gestureHandling: 'greedy' }); }, disable() { self._gh = 'none'; self.g.setOptions({ gestureHandling: 'none' }); } };
      this.touchZoom = { enable() {}, disable() {} };
      this.g.addListener('idle', () => this.fire('moveend'));
      this.g.addListener('zoom_changed', () => this.fire('zoomend'));
      this.g.addListener('click', e => { if (e.placeId) { try { e.stop(); } catch (x) {} this.fire('poiclick', { placeId: e.placeId, latlng: toLL(e.latLng) }); return; } this.fire('click', { latlng: toLL(e.latLng) }); });
      this.g.addListener('dblclick', e => this.fire('dblclick', { latlng: toLL(e.latLng) }));
    }
    setView(c, z) { const p = gl(c); if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) this.g.setCenter(p); if (Number.isFinite(z)) this.g.setZoom(z); return this; }
    getCenter() { return toLL(this.g.getCenter()); }
    getZoom() { return this.g.getZoom(); }
    setZoom(z) { this.g.setZoom(z); return this; }
    getBounds() { const b = this.g.getBounds(); if (!b) return new Bounds([0, 0], [0, 0]); return new Bounds(toLL(b.getSouthWest()), toLL(b.getNorthEast())); }
    fitBounds(b) { try { const x = b.g(); if (![x.south, x.west, x.north, x.east].every(Number.isFinite)) return this; this.g.fitBounds(x, 20); } catch (e) {} return this; }
    panBy(d) { this.g.panBy(d[0], d[1]); }
    hasLayer(l) { return !!(l && l._map); }
    removeLayer(l) { if (l) l.remove(); }
    _proj() { return this._ov.getProjection(); }
    latLngToContainerPoint(ll) { const l = toLL(ll), p = this._proj() && this._proj().fromLatLngToContainerPixel(new GM.LatLng(l.lat, l.lng)); return p ? pt(p.x, p.y) : pt(0, 0); }
    containerPointToLatLng(a) { const p = this._proj(); if (!p) return this.getCenter(); return toLL(p.fromContainerPixelToLatLng(new GM.Point(a[0], a[1]))); }
  }
  window.L = {
    map: (el, o) => new MapW(el, o),
    tileLayer: () => new Group(),
    layerGroup: () => new Group(),
    geoJSON: (d, o) => new GeoJSON(d, o),
    marker: (ll, o) => new Marker(ll, o || {}),
    divIcon: o => ({ html: o.html }),
    polyline: (p, o) => new Polyline(p, o),
    circle: (c, o) => new Circle(c, o),
    circleMarker,
    latLng: (a, b) => b == null ? toLL(a) : new LatLng(a, b),
    latLngBounds: (a, b) => { if (b !== undefined) a = [a, b]; const lats = a.map(x => toLL(x).lat), lngs = a.map(x => toLL(x).lng); return new Bounds([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]); },
    DomEvent: { stopPropagation() {} }
  };
}
