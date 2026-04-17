import {
  ImageCropperModal,
  builtInShapes,
  circleShape,
  heartShape,
  type CropResult,
  type ImageCropperHandle,
  type ImageCropperModalProps,
} from 'another-react-native-image-cropper';
import React, { useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SAMPLES = {
  landscape: {
    uri: 'https://picsum.photos/id/1011/2400/1600',
    width: 2400,
    height: 1600,
    author: 'Roberto Nickson',
  },
  portrait: {
    uri: 'https://picsum.photos/id/156/2177/3264',
    width: 2177,
    height: 3264,
    author: 'Christopher Sardegna',
  },
} as const satisfies Record<
  string,
  { uri: string; width: number; height: number; author: string }
>;

type SampleKey = keyof typeof SAMPLES;

const labels = {
  cancel: 'Cancel',
  confirm: 'Crop',
  instructions: 'Drag to pan, pinch to zoom — then tap the check.',
  errorMessage: 'Could not crop this image. Try again?',
};

type Config = Partial<ImageCropperModalProps>;

const CONFIGS = {
  'default': { modes: ['pan-zoom', 'draw'] },
  'panZoomOnly': { modes: ['pan-zoom'] },
  'drawOnly': { modes: ['draw'] },
  'theme-red': {
    modes: ['pan-zoom', 'draw'],
    theme: {
      colors: {
        text: { light: '#FF5555' },
        rectBorder: '#FF5555',
      },
    },
  },
  'toolbar-bottom': {
    modes: ['pan-zoom', 'draw'],
    toolbarPosition: 'bottom',
  },
  'custom-toolbar': {
    modes: ['pan-zoom', 'draw'],
    // `renderToolbar` injects a fully custom chrome inside the modal.
    // Useful when the built-in toolbar's layout doesn't fit your design.
    renderToolbar: ({ onCancel, onConfirm, disabled }) => (
      <View style={styles.customToolbar}>
        <TouchableOpacity
          onPress={onCancel}
          disabled={disabled}
          style={[styles.customToolbarButton, styles.customToolbarSecondary]}
        >
          <Text style={styles.customToolbarText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onConfirm}
          disabled={disabled}
          style={[styles.customToolbarButton, styles.customToolbarPrimary]}
        >
          <Text style={styles.customToolbarText}>Use photo</Text>
        </TouchableOpacity>
      </View>
    ),
  },
  'footer-hidden': {
    modes: ['pan-zoom', 'draw'],
    showFooter: false,
  },
  'all-shapes': {
    shapes: builtInShapes,
    defaultShape: 'rectangle',
  },
  'heart-only': {
    shapes: [heartShape],
  },
  'circle-only': {
    shapes: [circleShape],
  },
  // Tints Pan-Zoom's dim-area gesture zones so integrators can see the
  // hit regions while tuning `outlineInset` on custom shapes.
  'debug-zones': {
    shapes: builtInShapes,
    defaultShape: 'heart',
    debug: true,
  },
  // Regular rect crop but emitted as PNG. No mask, no Skia involved.
  'png-output': {
    modes: ['pan-zoom', 'draw'],
    outputFormat: 'png',
  },
  // Shape-masked output with transparent fill outside the shape +
  // white stroke on the silhouette. Result is a base64 PNG data URI.
  // Requires @shopify/react-native-skia (optional peer dep).
  'mask-transparent': {
    shapes: builtInShapes,
    defaultShape: 'heart',
    outputMask: {
      color: 'transparent',
      stroke: { color: '#FFFFFF', width: 2 },
    },
  },
  // Shape-masked output with a solid fill — demonstrates the same
  // pipeline without alpha.
  'mask-solid': {
    shapes: builtInShapes,
    defaultShape: 'circle',
    outputMask: { color: '#1A1A1A' },
  },
  // Shape-cutout output — the PNG is trimmed to the heart's tight
  // bbox instead of the full crop rect. Tighter output, same alpha.
  'cutout-heart': {
    shapes: builtInShapes,
    defaultShape: 'heart',
    outputCutout: {
      color: 'transparent',
      stroke: { color: '#FFFFFF', width: 2 },
      padding: 4,
    },
  },
} as const satisfies Record<string, Config>;

type ConfigKey = keyof typeof CONFIGS;

export default function App() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CropResult | null>(null);
  const [configKey, setConfigKey] = useState<ConfigKey>('default');
  const [sampleKey, setSampleKey] = useState<SampleKey>('landscape');
  // Kept in the tree even though the built-in toolbar is what most demos
  // use — having the ref available lets integrators see the API shape.
  const cropperRef = useRef<ImageCropperHandle>(null);
  const scrollRef = useRef<ScrollView>(null);

  const launch = (key: ConfigKey) => {
    setConfigKey(key);
    setOpen(true);
  };

  const selectSample = (key: SampleKey) => {
    setSampleKey(key);
    // Stale crop from the other orientation would linger otherwise.
    setResult(null);
  };

  const config = CONFIGS[configKey];
  const sample = SAMPLES[sampleKey];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>another-react-native-image-cropper</Text>
        <Text style={styles.subtitle}>
          Tap a configuration to launch the cropper.
        </Text>

        <View style={styles.sourceToggleRow}>
          {(['landscape', 'portrait'] as const).map((key) => {
            const active = key === sampleKey;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => selectSample(key)}
                style={[
                  styles.sourceToggle,
                  active && styles.sourceToggleActive,
                ]}
              >
                <Text
                  style={[
                    styles.sourceToggleText,
                    active && styles.sourceToggleTextActive,
                  ]}
                >
                  {key === 'landscape' ? 'Landscape' : 'Portrait'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Image
            source={{ uri: sample.uri }}
            style={[
              styles.preview,
              { aspectRatio: sample.width / sample.height },
            ]}
            resizeMode="cover"
          />
          <Text style={styles.caption}>
            {sample.width} × {sample.height} · Photo by {sample.author} —
            Unsplash
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Modes</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('default')}
          >
            <Text style={styles.buttonText}>Default · both modes</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('panZoomOnly')}
          >
            <Text style={styles.buttonText}>Pan/Zoom only</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('drawOnly')}
          >
            <Text style={styles.buttonText}>Draw only</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Shapes</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('all-shapes')}
          >
            <Text style={styles.buttonText}>All shapes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('heart-only')}
          >
            <Text style={styles.buttonText}>Heart only</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('circle-only')}
          >
            <Text style={styles.buttonText}>Circle only</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Customization</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('theme-red')}
          >
            <Text style={styles.buttonText}>Red theme override</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('toolbar-bottom')}
          >
            <Text style={styles.buttonText}>Toolbar at bottom</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('footer-hidden')}
          >
            <Text style={styles.buttonText}>Hide footer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('custom-toolbar')}
          >
            <Text style={styles.buttonText}>Custom toolbar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('debug-zones')}
          >
            <Text style={styles.buttonText}>Debug gesture zones</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Output</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('png-output')}
          >
            <Text style={styles.buttonText}>PNG output</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('mask-transparent')}
          >
            <Text style={styles.buttonText}>Mask: transparent + stroke</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('mask-solid')}
          >
            <Text style={styles.buttonText}>Mask: solid fill</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => launch('cutout-heart')}
          >
            <Text style={styles.buttonText}>Cutout: heart (tight bbox)</Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View style={styles.resultBlock}>
            <Text style={styles.resultLabel}>Cropped result</Text>
            {/* The result container has a checkerboard-ish background so
                transparent regions of a masked PNG are visibly
                transparent rather than blending into the page. */}
            <View style={styles.resultImageFrame}>
              <Image
                source={{ uri: result.uri }}
                style={styles.resultImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.caption}>
              {result.width} × {result.height} ·{' '}
              {result.uri.startsWith('data:')
                ? 'data URI (masked)'
                : 'file URI'}
            </Text>
          </View>
        )}
      </ScrollView>

      <ImageCropperModal
        ref={cropperRef}
        visible={open}
        sourceUri={sample.uri}
        sourceWidth={sample.width}
        sourceHeight={sample.height}
        labels={labels}
        onConfirm={(r) => {
          setResult(r);
          setOpen(false);
          // Give the modal its dismiss animation, then scroll the
          // result block into view so the cropped image is visible.
          setTimeout(
            () => scrollRef.current?.scrollToEnd({ animated: true }),
            350
          );
        }}
        onCancel={() => setOpen(false)}
        onModeChange={(m) => console.log('mode change', m)}
        onError={(err) => console.warn('crop error', err)}
        {...config}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0E0F12',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1B1D22',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  preview: {
    width: '100%',
  },
  sourceToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sourceToggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1B1D22',
  },
  sourceToggleActive: {
    backgroundColor: '#3B82F6',
  },
  sourceToggleText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  sourceToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  caption: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  resultBlock: {
    marginTop: 24,
  },
  resultLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
  },
  resultImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    // Tinted light background so transparent regions of a masked PNG
    // are obvious rather than blending into the page's dark backdrop.
    backgroundColor: '#6B7280',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  customToolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
  },
  customToolbarButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  customToolbarSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  customToolbarPrimary: {
    backgroundColor: '#10B981',
  },
  customToolbarText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
