const WALLY_OK = 0
    , ASSET_COMMITMENT_LEN = 33
    , ASSET_GENERATOR_LEN = 33
    , ASSET_TAG_LEN = 32
    , BLINDING_FACTOR_LEN = 32

const STATIC_ROOT = process.env.STATIC_ROOT || ''
    , WASM_URL = process.env.LIBWALLY_WASM_URL || `${STATIC_ROOT}libwally/wallycore.js`

let load_promise, Module
export function load() {
  return load_promise || (load_promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = WASM_URL
    script.addEventListener('error', reject)
    script.addEventListener('load', () =>
      InitWally().then(module => { Module=module; resolve() }, reject))
    document.body.appendChild(script)
  }))
}

// Simple wrapper to execute both asset_generator_from_bytes and asset_value_commitment,
// with hex conversions. `value` is expected to be a BigInt.
export function generate_commitments(value, asset_hex, value_blinder_hex, asset_blinder_hex) {
  const asset = parseHex(asset_hex, ASSET_TAG_LEN)
      , value_blinder = parseHex(value_blinder_hex, BLINDING_FACTOR_LEN)
      , asset_blinder = parseHex(asset_blinder_hex, BLINDING_FACTOR_LEN)

  const asset_commitment = asset_generator_from_bytes(asset, asset_blinder)
      , value_commitment = asset_value_commitment(value, value_blinder, asset_commitment)

  return { asset_commitment: encodeHex(asset_commitment)
         , value_commitment: encodeHex(value_commitment) }
}

export function asset_generator_from_bytes(asset, asset_blinder) {
  const asset_commitment_ptr = Module._malloc(ASSET_GENERATOR_LEN)
  checkCode(Module.ccall('wally_asset_generator_from_bytes'
    , 'number'
    , [ 'array', 'number', 'array', 'number', 'number', 'number' ]
    , [ asset, asset.length
      , asset_blinder, asset_blinder.length
      , asset_commitment_ptr, ASSET_GENERATOR_LEN
      ]))

  const asset_commitment = readBytes(asset_commitment_ptr, ASSET_GENERATOR_LEN)
  Module._free(asset_commitment_ptr)
  return asset_commitment
}

export function asset_value_commitment(value, value_blinder, asset_commitment) {
  const value_commitment_ptr = Module._malloc(ASSET_COMMITMENT_LEN)
  checkCode(Module.ccall('wally_asset_value_commitment'
    , 'number'
    , [ 'number', 'array', 'number', 'array', 'number', 'number', 'number' ]
    , [ value
      , value_blinder, value_blinder.length
      , asset_commitment, asset_commitment.length
      , value_commitment_ptr, ASSET_COMMITMENT_LEN
      ]))

  const value_commitment = readBytes(value_commitment_ptr, ASSET_COMMITMENT_LEN)
  Module._free(value_commitment_ptr)
  return value_commitment
}

function checkCode(code) {
  if (code != WALLY_OK)
    throw new Error(`libwally failed with code ${code}`)
}

function readBytes(ptr, size) {
  const bytes = new Uint8Array(size)
  for (let i=0; i<size; i++) bytes[i] = Module.getValue(ptr+i, 'i8')
  return bytes
}

function encodeHex(bytes) {
  return Buffer.from(bytes).toString('hex')
  //return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Parse hex string encoded in *reverse*
function parseHex(str, expected_size) {
  if (!/^([0-9a-f]{2})+$/.test(str)) throw new Error('Invalid blinders (invalid hex)')
  if (str.length != expected_size*2) throw new Error('Invalid blinders (invalid length)')
  return new Uint8Array(str.match(/.{2}/g).map(hex_byte => parseInt(hex_byte, 16)).reverse())
}
