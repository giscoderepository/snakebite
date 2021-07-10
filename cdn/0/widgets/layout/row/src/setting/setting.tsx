/** @jsx jsx */
import { React, jsx, APP_FRAME_NAME_IN_BUILDER } from 'jimu-core'
import { AllWidgetSettingProps } from 'jimu-for-builder'
import { SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { IMRowConfig } from '../config'
import { Sides, LinearUnit, utils, FourSidesUnit, UnitTypes, styleUtils } from 'jimu-ui'
import { defaultConfig } from '../default-config'
import defaultMessages from './translations/default'
import { FourSides, InputUnit } from 'jimu-ui/advanced/style-setting-components'

const marginSides = [Sides.T, Sides.R, Sides.B, Sides.L]

export default class Setting extends React.PureComponent<AllWidgetSettingProps<IMRowConfig>> {
  handleSpaceChange = (value: LinearUnit): void => {
    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.set('space', value.distance)
    })
  }

  handlePaddingChange = (value: FourSidesUnit): void => {
    const config = this.props.config
    const style = config.style ?? defaultConfig.style
    const previousUnit = style.padding.unit
    let paddingNumbers: number[] = styleUtils.expandStyleArray(value.number)

    if (previousUnit !== value.unit) {
      // convert value to specified unit
      const rect = this.getSizeOfItem()
      if (rect != null) {
        paddingNumbers = paddingNumbers.map((numItem, index) => {
          const size = index % 2 === 0 ? rect.height : rect.width
          if (value.unit === UnitTypes.PIXEL) {
            // convert from percentage to pixel
            return Math.round(numItem * size / 100)
          }
          // convert from pixel to percentage, keep 1 decimal number
          return Math.round((numItem / size) * 1000) / 10
        })
      }
    }

    this.props.onSettingChange({
      id: this.props.id,
      config: this.props.config.setIn(['style', 'padding'], {
        number: paddingNumbers,
        unit: value.unit
      })
    })
  }

  getSizeOfItem (): ClientRect {
    const { id } = this.props
    const widgetElem = this.querySelector(`div[data-widgetid="${id}"]`)
    if (widgetElem != null) {
      return widgetElem.getBoundingClientRect()
    }
    return null
  }

  querySelector (selector: string): HTMLElement {
    const appFrame: HTMLFrameElement = document.querySelector(`iframe[name="${APP_FRAME_NAME_IN_BUILDER}"]`)
    if (appFrame != null) {
      const appFrameDoc = appFrame.contentDocument || appFrame.contentWindow.document
      return appFrameDoc.querySelector(selector)
    }
    return null
  }

  formatMessage = (id: string): string => {
    return this.props.intl.formatMessage({ id, defaultMessage: defaultMessages[id] })
  }

  render (): JSX.Element {
    const config = this.props.config
    const style = config.style ?? defaultConfig.style
    const space = config.space >= 0 ? config.space : defaultConfig.space
    const max = style.padding?.unit === UnitTypes.PERCENTAGE ? 100 : Number.POSITIVE_INFINITY

    return (
      <div className='row-layout-setting'>
        <SettingSection title={this.formatMessage('layout')}>
          <SettingRow label={this.formatMessage('gap')}>
            <InputUnit value={utils.stringOfLinearUnit(space)} min={0} onChange={this.handleSpaceChange} style={{ width: 110 }} />
          </SettingRow>
          <SettingRow label={this.formatMessage('padding')} flow='wrap'>
            <FourSides
              showTip sides={marginSides} value={style.padding as any} max={max}
              onChange={this.handlePaddingChange}
            />
          </SettingRow>
        </SettingSection>
      </div>
    )
  }
}
