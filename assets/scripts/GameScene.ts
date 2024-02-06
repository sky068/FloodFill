/*
 * @Author: xujiawei 
 * @Date: 2024-02-04 19:02:41 
 * @Last Modified by: xujiawei
 * @Last Modified time: 2024-02-04 19:15:59
 */

import { Component, Sprite, Texture2D, _decorator, Node, EventTouch, SpriteFrame, ImageAsset, UITransform, v3, Color } from "cc";
import ColorFilterTexture from "./ColorFillTexture";
import logicConfig from "./LogicConfig";
const { ccclass, property } = _decorator;

@ccclass
export default class GameScene extends Component {
	@property(Texture2D)
	texture2D: Texture2D = null;

	@property(Sprite)
	sprite: Sprite = null;

	private _colorFillTexture: ColorFilterTexture = null;

	protected start(): void {
		this.sprite.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
		this.createColorFill(this.texture2D);
	}

	protected onTouchStart(event: EventTouch): void {
		let location = event.touch.getUILocation();
		let uiTransform = this.sprite.getComponent(UITransform);
		let position = uiTransform.convertToNodeSpaceAR(v3(location.x, location.y, 0));
		let color = new Color(0, 255, 0, 255);
		this._colorFillTexture.fillTextureColor(color, position.x, position.y);
	}
	
	private createColorFill(texture: Texture2D): void {
		this._colorFillTexture = new ColorFilterTexture(texture, logicConfig.alphaThreshold, logicConfig.maxFillCount);
		let spriteFrame = new SpriteFrame();
		spriteFrame.texture = this._colorFillTexture.texture;
		this.sprite.spriteFrame = spriteFrame;
	}

	private onImageLoad(data: string): void {
		let image = new Image();
		image.src = data;
		image.addEventListener('load', () => {
			let texture = new Texture2D();
			texture.image = new ImageAsset(image);
			this.createColorFill(texture);
		});
	}
}