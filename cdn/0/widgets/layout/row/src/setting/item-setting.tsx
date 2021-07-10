/** @jsx jsx */
import {
  React,
  Immutable,
  jsx,
  css,
  lodash,
  APP_FRAME_NAME_IN_BUILDER,
  LayoutItemType,
  IMBoundingBox,
  SerializedStyles
} from 'jimu-core'
import {
  SettingSection,
  SettingRow
} from 'jimu-ui/advanced/setting-components'
import { LayoutItemSettingProps, CommonLayoutItemSetting, CommonTransformSetting } from 'jimu-layouts/layout-builder'
import { LayoutItemSizeModes, utils as layoutUtils } from 'jimu-layouts/layout-runtime'

import { LinearUnit, Select, NumericInput, utils, UnitTypes, Checkbox } from 'jimu-ui'
import { RowLayoutItemSetting } from '../config'
import { DEFAULT_ROW_ITEM_SETTING } from '../default-config'
import { SizeEditor, InputRatio } from 'jimu-ui/advanced/style-setting-components'

const inputStyle = { width: '7.5rem' }

const heightModes = [LayoutItemSizeModes.Auto, LayoutItemSizeModes.Stretch, LayoutItemSizeModes.Custom]

export default class RowItemSetting extends React.PureComponent<LayoutItemSettingProps> {
  updateStyle (key, value): void {
    const { layoutItem } = this.props
    const style = Immutable(layoutItem?.setting?.style ?? {})
    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      {
        style: style.set(key, value)
      }
    )
  }

  handleAlignChange = (e): void => {
    this.updateStyle('alignSelf', e.target.value)
  }

  handleHeightChange = (value: LinearUnit): void => {
    let bbox = this.props.layoutItem.bbox as IMBoundingBox
    const { distance, unit } = value
    const originalValue = bbox.height
    const contaienrRect = this.getSizeOfContainer()
    let newValue: string | number = distance.toFixed(2)

    if (layoutUtils.isPercentage(originalValue) && unit === UnitTypes.PIXEL) { // change from percentage to pixel
      if (contaienrRect != null) {
        newValue = Math.round(parseFloat(originalValue) * contaienrRect.height / 100)
      }
    } else if (!layoutUtils.isPercentage(originalValue) && unit === UnitTypes.PERCENTAGE) { // change from pixel to percentage
      if (contaienrRect != null) {
        newValue = (parseFloat(originalValue) * 100 / contaienrRect.height).toFixed(4)
      }
    }

    bbox = bbox.set('height', unit === UnitTypes.PERCENTAGE ? `${newValue}%` : `${newValue}px`)

    this.props.onPosChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      bbox
    )
  }

  handleHeightModeChange = (mode: LayoutItemSizeModes): void => {
    const setting = this.props.layoutItem.setting ?? Immutable({})
    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      setting.setIn(['autoProps', 'height'], mode)
    )
  }

  updateAspectSetting = (heightMode?: string): void => {
    let setting = this.props.layoutItem.setting ?? Immutable({})
    setting = setting.set('heightMode', heightMode)
    if (heightMode === 'ratio') {
      const itemRect = this.getSizeOfItem()
      if (itemRect != null) {
        setting = setting.set('aspectRatio', Number((itemRect.height / itemRect.width).toFixed(2)))
      }
    } else {
      const bbox = this.props.layoutItem.bbox as IMBoundingBox
      const rect = this.getSizeOfItem()
      if (layoutUtils.isPercentage(bbox.height)) {
        const contaienrRect = this.getSizeOfContainer()
        this.props.onPosChange(
          {
            layoutId: this.props.layoutId,
            layoutItemId: this.props.layoutItem.id
          },
          bbox.set('height', `${(rect.height * 100 / contaienrRect.height).toFixed(4)}%`)
        )
      } else {
        this.props.onPosChange(
          {
            layoutId: this.props.layoutId,
            layoutItemId: this.props.layoutItem.id
          },
          bbox.set('height', `${Math.round(rect.height)}px`)
        )
      }
    }

    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      setting
    )
  }

  handleAspectRatioChange = (newRatio): void => {
    let setting = this.props.layoutItem.setting ?? Immutable({})
    setting = setting.set('aspectRatio', newRatio)
    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      setting
    )
  }

  handleOffsetXChange = (value: number): void => {
    const setting = this.props.layoutItem.setting ?? Immutable({})
    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      setting.set('offsetX', value)
    )
  }

  handleOffsetYChange = (value: number): void => {
    const setting = this.props.layoutItem.setting ?? Immutable({})
    this.props.onSettingChange(
      {
        layoutId: this.props.layoutId,
        layoutItemId: this.props.layoutItem.id
      },
      setting.set('offsetY', value)
    )
  }

  formatMessage = (id: string): string => {
    return this.props.formatMessage(id)
  }

  getSizeOfContainer (): ClientRect {
    const layoutElem = this.querySelector(`div.row-layout[data-layoutid="${this.props.layoutId}"]`)
    if (layoutElem != null) {
      return layoutElem.getBoundingClientRect()
    }
    return null
  }

  getSizeOfItem (): ClientRect {
    const { layoutId, layoutItem } = this.props
    const layoutElem = this.querySelector(
      `div.exb-rnd[data-layoutid="${layoutId}"][data-layoutitemid="${layoutItem.id}"] > div.widget-renderer`)
    if (layoutElem != null) {
      return layoutElem.getBoundingClientRect()
    }
    return null
  }

  querySelector (selector: string): HTMLElement {
    const appFrame: HTMLFrameElement = document.querySelector(`iframe[name="${APP_FRAME_NAME_IN_BUILDER}"]`)
    if (appFrame != null) {
      const appFrameDoc = appFrame.contentDocument ?? appFrame.contentWindow.document
      return appFrameDoc.querySelector(selector)
    }
    return null
  }

  getStyle (): SerializedStyles {
    return css`
      .align-select {
        .dropdown-button, .dropdown-button:hover {
          height: 26px;
        }
      }
    `
  }

  render (): JSX.Element {
    const { layoutId, layoutItem, isLockLayout } = this.props
    if (layoutItem == null) {
      return null
    }
    const itemSetting: RowLayoutItemSetting = lodash.assign({}, DEFAULT_ROW_ITEM_SETTING, layoutItem.setting)
    const bbox = layoutItem.bbox
    const style = itemSetting.style ?? {} as any
    const heightMode = itemSetting.autoProps?.height ?? LayoutItemSizeModes.Stretch
    const keepAspectRatio = itemSetting.heightMode === 'ratio'

    return (
      <div className='row-item-setting' css={this.getStyle()}>
        {!isLockLayout &&
          <React.Fragment>
            <SettingSection title={this.formatMessage('size')}>
              <SettingRow label={this.formatMessage('height')}>
                <div style={inputStyle}>
                  <SizeEditor
                    label='H'
                    mode={heightMode}
                    sizeModes={heightModes}
                    value={utils.stringOfLinearUnit(bbox.height)}
                    onChange={this.handleHeightChange}
                    onModeChange={this.handleHeightModeChange}
                    disabled={keepAspectRatio}
                  />
                </div>
              </SettingRow>
              {heightMode === LayoutItemSizeModes.Custom &&
                <SettingRow>
                  <Checkbox
                    checked={keepAspectRatio}
                    onChange={(e) => this.updateAspectSetting(e.target.checked ? 'ratio' : 'fixed')}
                    className='mr-2'
                  />
                  {this.formatMessage('keepAspectRatio')}
                </SettingRow>}
              {keepAspectRatio &&
                <SettingRow label={this.formatMessage('aspectRatio')}>
                  <InputRatio value={itemSetting.aspectRatio} style={inputStyle} onChange={this.handleAspectRatioChange} />
                </SettingRow>}
              {(heightMode !== LayoutItemSizeModes.Stretch) &&
                <SettingRow label={this.formatMessage('align')}>
                  <Select className='align-select' style={inputStyle} value={style.alignSelf ?? 'flex-start'} onChange={this.handleAlignChange}>
                    <option value='flex-start'>{this.formatMessage('T')}</option>
                    <option value='flex-end'>{this.formatMessage('B')}</option>
                    <option value='center'>{this.formatMessage('center')}</option>
                  </Select>
                </SettingRow>}
            </SettingSection>
            <SettingSection title={this.formatMessage('position')}>
              <CommonTransformSetting
                layoutId={layoutId}
                layoutItemId={layoutItem.id}
                setting={layoutItem.setting}
                onSettingChange={this.props.onSettingChange}
                formatMessage={this.props.formatMessage}
              />
              <SettingRow label={this.formatMessage('offsetX')}>
                <NumericInput
                  style={inputStyle}
                  value={itemSetting.offsetX}
                  onChange={this.handleOffsetXChange}
                  size='sm'
                />
              </SettingRow>
              <SettingRow label={this.formatMessage('offsetY')}>
                <NumericInput
                  style={inputStyle}
                  value={itemSetting.offsetY}
                  onChange={this.handleOffsetYChange}
                  size='sm'
                />
              </SettingRow>
            </SettingSection>
          </React.Fragment>}
        {(layoutItem.widgetId != null || layoutItem.sectionId != null) &&
          <CommonLayoutItemSetting
            layoutId={layoutId}
            layoutItemId={layoutItem.id}
            isSection={layoutItem.type === LayoutItemType.Section}
            style={this.props.style}
            onStyleChange={this.props.onStyleChange}
            onSettingChange={this.props.onSettingChange}
            formatMessage={this.props.formatMessage}
          />}
      </div>
    )
  }
}
