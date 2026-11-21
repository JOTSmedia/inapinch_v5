// Minimal Mapbox Vector Tile reader. Pass a layer name when reading a live tile
// to skip unrelated geometry, feature attributes and string dictionaries.
const textDecoder = new TextDecoder();

function readFields(bytes) {
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.end;
    const field = Math.floor(tag.value / 8);
    const wire = tag.value & 7;
    let value;
    if (wire === 0) {
      const item = readVarint(bytes, offset);
      value = item.value;
      offset = item.end;
    } else if (wire === 2) {
      const length = readVarint(bytes, offset);
      offset = length.end + length.value;
      if (offset > bytes.length) throw Error('Truncated protobuf field');
      value = bytes.subarray(length.end, offset);
    } else if (wire === 1 || wire === 5) {
      const width = wire === 1 ? 8 : 4;
      if (offset + width > bytes.length) throw Error('Truncated protobuf number');
      const view = new DataView(bytes.buffer, bytes.byteOffset + offset, width);
      value = width === 8 ? view.getFloat64(0, true) : view.getFloat32(0, true);
      offset += width;
    } else {
      throw Error('Unsupported protobuf wire type ' + wire);
    }
    if (!field) throw Error('Invalid protobuf field number');
    fields.push([field, value]);
  }
  return fields;
}

function readVarint(bytes, start) {
  let value = 0, scale = 1;
  for (let offset = start; offset < bytes.length && offset < start + 10; offset++) {
    const byte = bytes[offset];
    if (offset === start + 9 && byte > 1) throw Error('Invalid protobuf integer');
    value += (byte & 127) * scale;
    if (byte < 128) return {value, end: offset + 1};
    scale *= 128;
  }
  throw Error('Truncated protobuf integer');
}

function packedInts(bytes) {
  const values = [];
  for (let offset = 0; offset < bytes.length;) {
    const item = readVarint(bytes, offset);
    offset = item.end;
    values.push(item.value);
  }
  return values;
}

const signed = n => n % 2 ? -(n + 1) / 2 : n / 2;

export function decodeTile(bytes, selectedLayer) {
  const result = {};
  const fields = readFields(bytes);
  if (bytes.length && !fields.some(([field]) => field === 3)) throw Error('Invalid vector tile: missing layers');
  for (const [field, raw] of fields) {
    if (field !== 3) continue;
    const layer = readFields(raw);
    const label = layer.find(([n]) => n === 1);
    if (!label) throw Error('Vector tile layer has no name');
    const name = textDecoder.decode(label[1]);
    if (selectedLayer && selectedLayer !== name) continue;
    const keys = layer.filter(([n]) => n === 3).map(([,b]) => textDecoder.decode(b));
    const values = layer.filter(([n]) => n === 4).map(([,b]) => {
      const [type, value] = readFields(b)[0] || [];
      if (type === 1) return textDecoder.decode(value);
      if (type === 7) return !!value;
      return type === 6 ? signed(value) : value;
    });
    const extent = layer.find(([n]) => n === 5)?.[1] ?? 4096;
    if (!(extent > 0)) throw Error('Invalid vector tile extent');
    const features = [];
    for (const [number, entry] of layer) {
      if (number !== 2) continue;
      const f = readFields(entry);
      const type = f.find(([n]) => n === 3)?.[1];
      if (selectedLayer === 'poi' && type !== 1) continue;
      const numericId = f.find(([n]) => n === 1)?.[1];
      const properties = Object.create(null);
      const tagBytes = f.find(([n]) => n === 2)?.[1];
      if (tagBytes) {
        const tags = packedInts(tagBytes);
        for (let i = 0; i < tags.length; i += 2) {
          if (tags[i] >= keys.length || !(tags[i + 1] < values.length)) throw Error('Invalid feature attributes');
          properties[keys[tags[i]]] = values[tags[i + 1]];
        }
      }
      const geometry = f.find(([n]) => n === 4)?.[1];
      let x = null, y = null;
      if (geometry?.length) {
        const command = readVarint(geometry, 0);
        if ((command.value & 7) === 1) {
          const dx = readVarint(geometry, command.end);
          x = signed(dx.value);
          y = signed(readVarint(geometry, dx.end).value);
        }
      }
      // Use coordinate-based identity downstream for IDs outside JS precision.
      const id = Number.isSafeInteger(numericId) ? numericId : undefined;
      features.push({id, type, x, y, properties, extent});
    }
    result[name] = features;
  }
  return result;
}

export function pointToCoordinates(x, y, z, tx, ty, extent = 4096) {
  const size = 2 ** z;
  const lng = (tx + x / extent) / size * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + y / extent) / size))) * 180 / Math.PI;
  return {lat, lng};
}
