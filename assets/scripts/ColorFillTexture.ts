/*
 * @Author: xujiawei 
 * @Date: 2024-02-04 11:57:29 
 * @Last Modified by: xujiawei
 * @Last Modified time: 2024-02-04 19:03:27
 * 
 * @ref https://forum.cocos.org/t/cocos-creator/82612/39
 * @ref https://blog.csdn.net/Ctrls_/article/details/136008679?spm=1001.2014.3001.5501
 */

import { _decorator, Component, gfx, Color, Texture2D, IVec2, v2, director} from 'cc';
const { ccclass } = _decorator;

enum GridIndex {
	CENTER,
	UP,
	DOWN,
	LEFT,
	RIGHT
}

const gridIndexOffset: IVec2[] = [null, v2(0, +1), v2(0, -1), v2(-1, 0), v2(+1, 0)];
const gridIndexNeighbors: Array<GridIndex>[] = [];
gridIndexNeighbors[GridIndex.CENTER] = [GridIndex.UP, GridIndex.DOWN, GridIndex.LEFT, GridIndex.RIGHT];
gridIndexNeighbors[GridIndex.UP] = [GridIndex.UP, GridIndex.LEFT, GridIndex.RIGHT];
gridIndexNeighbors[GridIndex.DOWN] = [GridIndex.DOWN, GridIndex.LEFT, GridIndex.RIGHT];
gridIndexNeighbors[GridIndex.LEFT] = [GridIndex.LEFT, GridIndex.UP, GridIndex.DOWN];
gridIndexNeighbors[GridIndex.RIGHT] = [GridIndex.RIGHT, GridIndex.UP, GridIndex.DOWN];

@ccclass
export default class ColorFilterTexture extends Component {
	public readonly texture: Texture2D = null;
	public readonly sourceData: Uint8Array = null;
	public readonly targetData: Uint8Array = null;
	public readonly width: number = 0;
	public readonly height: number = 0;
	private _maxFillCount: number = 30;
	private _alphaThreshold: number = 150;

	public constructor(source: Texture2D, alphaThreshold: number = 100, maxFillCount: number = 30) {
		super();
		this.sourceData = ColorFilterTexture.readTexturePixels(source);
		this.targetData = Uint8Array.from(this.sourceData);
		this.texture = ColorFilterTexture.createTextureFromPixels(this.targetData, source.width, source.height);
		this.width = this.texture.width;
		this.height = this.texture.height;
		this._maxFillCount = maxFillCount;
		this._alphaThreshold = alphaThreshold;
	}

	public setTextureColor(color: Color, x: number, y: number): boolean {
		x = ColorFilterTexture.translateX(this.width, x);
		y = ColorFilterTexture.translateY(this.height, y);
		return this.setColor(color, x, y);
	}

	/**
	 * cocos坐标转到图片坐标系, cocos默认坐标系是图片中心，X向右Y向上，而图片格式的坐标默认是在左上角，X向右Y向下
	 * @param width 
	 * @param x 
	 */
	public static translateX(width: number, x: number): number {
		return Math.trunc(x + width * 0.5);
	}

	public static translateY(heigth: number, y: number): number {
		return Math.trunc(-y + heigth * 0.5);
	}

	private setColor(color: Color, x: number, y: number): boolean {
		if (x < 0 || y < 0 || x > this.width || y > this.height) {
			return false;
		}
		ColorFilterTexture.setBufferColor(this.targetData, this.width, x, y, color);
		if (ColorFilterTexture.getAlphaColor(this.sourceData, this.width, x, y) > this._alphaThreshold) {
			return false;
		}
		return true;
	}

	private static setBufferColor(buffer: Uint8Array, width: number, x: number, y: number, color: Color): void {
		let index = ColorFilterTexture.positionToBufferIndex(width, x, y);
		buffer[index + 0] = color.r;
		buffer[index + 1] = color.g;
		buffer[index + 2] = color.b;
		buffer[index + 3] = color.a;
	}

	public static readTexturePixels(texture: Texture2D, x: number = 0, y: number = 0): Uint8Array {
		let gfxTexture = texture.getGFXTexture();
		if (!gfxTexture) {
			return null;
		}
		let buffSize = 4 * texture.width * texture.height;
		let buffer = new Uint8Array(buffSize);

		let region = new gfx.BufferTextureCopy();
		region.texOffset.x = x;
		region.texOffset.y = y;
		region.texExtent.width = texture.width;
		region.texExtent.height = texture.height;
        director.root.device.copyTextureToBuffers(gfxTexture, [buffer], [region]);
		return buffer;
	}

    /**
     * 从像素的buffer中创建一个texture
     * @param buffer
     * @param height 
     * @param h 
     * @param format
     * @param mipmapLevel mipmap等级
     * @returns 新的texture
     */
	public static createTextureFromPixels(buffer: Uint8Array, width: number, height: number, format = Texture2D.PixelFormat.RGBA8888, mipmapLevel?: number): Texture2D {
        let texture = new Texture2D();
        texture.reset({width, height, format, mipmapLevel});
        texture.uploadData(buffer);
        return texture;
	}

	/**
	 * 获取指定位置颜色的透明度
	 * @param buffer 颜色buffer
	 * @param width 图片宽度
	 * @param x 
	 * @param y 
	 * @returns 
	 */
	public static getAlphaColor(buffer: Uint8Array, width: number, x: number, y: number): number {
		let index = ColorFilterTexture.positionToBufferIndex(width, x, y);
		return buffer[index + 3];
	}

	/**
	 * 点坐标转换成图片buffer的索引
	 * @param width 图片宽度
	 * @param x 
	 * @param y 
	 * @param colorSize 颜色是RGB还是RGBA
	 * @returns buffer的索引
	 */
	public static positionToBufferIndex(width: number, x: number, y: number, colorSize: 3 | 4 = 4): number {
		return Math.trunc(x + y * width) * colorSize;
	}

	public fillTextureColor(color: Color, x: number, y: number): void {
		x = ColorFilterTexture.translateX(this.width, x);
		y = ColorFilterTexture.translateY(this.height, y);
		this.fillColor(color, x, y, gridIndexNeighbors[GridIndex.CENTER]);
	}

	private async fillColor(color: Color, x: number, y: number, gridIndexTypes: readonly GridIndex[]) {
		let colorPointList1 = [{x, y, neighborTypes: gridIndexTypes}];
		let colorPointList2 = [];
		let fillCount = 0;
		do {
			for (const item of colorPointList1) {
				const ret = this.setColor(color, item.x, item.y);
				for (let type of item.neighborTypes) {
					const offset = gridIndexOffset[type];
					const nx = item.x + offset.x, ny = item.y + offset.y;
					if (ColorFilterTexture.getAlphaColor(this.targetData, this.width, nx, ny) == color.a) {
						continue;
					}
					if (colorPointList2.find(v => v.x == nx && v.y == ny) == null) {
						colorPointList2.push({x: nx, y: ny, neighborTypes: gridIndexNeighbors[type]});
					}
				}
				if (!ret) continue;
			}
			let temp = colorPointList1;
			colorPointList1 = colorPointList2;
			colorPointList2 = temp;
			colorPointList2.length = 0;
			if (++fillCount > this._maxFillCount) {
				fillCount = 0;
				this.updateTextureData();
			}
		} while(colorPointList1.length > 0);

		this.updateTextureData();
	}

    public updateTextureData(): void {
		this.texture.uploadData(this.targetData);
	}
 }