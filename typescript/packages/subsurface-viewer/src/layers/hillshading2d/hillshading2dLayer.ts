import type { PickingInfo } from "@deck.gl/core";
import type { Texture } from "@luma.gl/core";
import type { BitmapLayerPickingInfo, BitmapLayerProps } from "@deck.gl/layers";
import { BitmapLayer } from "@deck.gl/layers";

import type { ReportBoundingBoxAction } from "../../components/Map";
import type { LayerPickInfo } from "../../layers/utils/layerTools";
import { decoder } from "../shader_modules";
import { getModelMatrix } from "../utils/layerTools";
import type { ValueDecoder } from "../utils/propertyMapTools";
import { decodeRGB } from "../utils/propertyMapTools";

import fsHillshading from "./hillshading2d.fs.glsl";

// Most props are inherited from DeckGL's BitmapLayer. For a full list, see:
// https://deck.gl/docs/api-reference/layers/bitmap-layer
//
// The property map is encoded in an image and sent in the `image` prop of the BitmapLayer.
// For more details on the property map encoding, see colormapLayer.ts
export interface Hillshading2DProps extends BitmapLayerProps {
    // Min and max property values.
    valueRange: [number, number];

    // Direction the light comes from.
    lightDirection: [number, number, number];
    // Intensity of light that is applied to the whole map uniformly.
    ambientLightIntensity: number;
    // Intensity of light that is applied to the lightened potions of the map.
    diffuseLightIntensity: number;

    // Use color map in this range
    colorMapRange: [number, number];

    // By default, scale the [0, 256*256*256-1] decoded values to [0, 1]
    valueDecoder: ValueDecoder;

    // Rotates image around bounds upper left corner counterclockwise in degrees.
    rotDeg: number;

    // Non public properties:
    reportBoundingBox?: React.Dispatch<ReportBoundingBoxAction>;
}

const defaultProps = {
    "@@type": "Hillshading2DLayer",
    name: "Hill shading",
    id: "hillshading-layer",
    opacity: 1.0,
    pickable: true,
    visible: true,
    rotDeg: 0,
    valueRange: { type: "array", value: [0, 1] },
    lightDirection: [1, 1, 1],
    ambientLightIntensity: 0.5,
    diffuseLightIntensity: 0.5,
    valueDecoder: {
        rgbScaler: [1, 1, 1],
        // By default, scale the [0, 256*256*256-1] decoded values to [0, 1]
        floatScaler: 1.0 / (256.0 * 256.0 * 256.0 - 1.0),
        offset: 0,
        step: 0,
    },
};

export default class Hillshading2DLayer extends BitmapLayer<Hillshading2DProps> {
    initializeState(): void {
        super.initializeState();
    }

    // Signature from the base class, eslint doesn't like the any type.
    // eslint-disable-next-line
    draw({ moduleParameters, uniforms }: any): void {
        if (!this.isLoaded) {
            if (typeof this.props.reportBoundingBox !== "undefined") {
                const xMin = this.props.bounds[0] as number;
                const yMin = this.props.bounds[1] as number;
                const zMin = 1;
                const xMax = this.props.bounds[2] as number;
                const yMax = this.props.bounds[3] as number;
                const zMax = -1;

                this.props.reportBoundingBox({
                    layerBoundingBox: [xMin, yMin, zMin, xMax, yMax, zMax],
                });
            }
        }

        if (this.props.image) {
            const mergedModuleParams = {
                ...moduleParameters,
                valueDecoder: {
                    // The prop objects are not merged with the defaultProps by default.
                    // See https://github.com/facebook/react/issues/2568
                    ...defaultProps.valueDecoder,
                    ...moduleParameters.valueDecoder,
                },
                modelMatrix: getModelMatrix(
                    this.props.rotDeg,
                    this.props.bounds[0] as number, // Rotate around upper left corner of bounds
                    this.props.bounds[3] as number
                ),
            };
            super.setModuleParameters(mergedModuleParams);

            const valueRangeMin = this.props.valueRange[0] ?? 0.0;
            const valueRangeMax = this.props.valueRange[1] ?? 1.0;
            const colorMapRangeMin =
                this.props.colorMapRange?.[0] ?? valueRangeMin;
            const colorMapRangeMax =
                this.props.colorMapRange?.[1] ?? valueRangeMax;

            const [minVal, maxVal] = this.props.valueRange;
            super.draw({
                uniforms: {
                    ...uniforms,
                    // Send extra uniforms to the shader.
                    bitmapResolution: [
                        (this.props.image as Texture).width,
                        (this.props.image as Texture).height,
                    ],
                    valueRangeSize: maxVal - minVal,
                    lightDirection: this.props.lightDirection,
                    ambientLightIntensity: this.props.ambientLightIntensity,
                    diffuseLightIntensity: this.props.diffuseLightIntensity,
                    valueRangeMin,
                    valueRangeMax,
                    colorMapRangeMin,
                    colorMapRangeMax,
                },
                moduleParameters: mergedModuleParams,
            });
        }
    }

    // Signature from the base class, eslint doesn't like the any type.
    // eslint-disable-next-line
    getShaders(): any {
        const parentShaders = super.getShaders();
        // Overwrite the BitmapLayer's default fragment shader with ours, that does hillshading.
        parentShaders.fs = fsHillshading;
        // Add the decoder shader module to our colormap shader, so we can use the decoder function from our shader.
        parentShaders.modules.push(decoder);
        return parentShaders;
    }

    getPickingInfo({
        info,
    }: {
        info: PickingInfo;
    }): BitmapLayerPickingInfo & LayerPickInfo {
        if (!info.color) {
            return info as BitmapLayerPickingInfo;
        }

        const mergedDecoder = {
            ...defaultProps.valueDecoder,
            ...this.props.valueDecoder,
        };
        // The picked color is the one in raw image, not the one after hillshading.
        // We just need to decode that RGB color into a property float value.
        const val = decodeRGB(info.color, mergedDecoder, this.props.valueRange);

        return {
            ...info,
            // Picking color doesn't represent object index in this layer.
            // For more details, see https://deck.gl/docs/developer-guide/custom-layers/picking
            index: 0,
            propertyValue: val,
        } as unknown as BitmapLayerPickingInfo;
    }
}

Hillshading2DLayer.layerName = "Hillshading2DLayer";
Hillshading2DLayer.defaultProps = defaultProps;
