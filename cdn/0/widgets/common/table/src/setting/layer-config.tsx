/** @jsx jsx */
import {
  React,
  jsx,
  ThemeVariables,
  Immutable,
  IntlShape,
  IMUseDataSource,
  UseDataSource,
  SerializedStyles,
  polished,
  css,
  JimuFieldType,
  DataSourceComponent,
  QueriableDataSource,
  IMFieldSchema,
  FeatureLayerDataSource,
  CONSTANTS
} from 'jimu-core'
import { SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import {
  TextInput,
  Switch,
  defaultMessages as jimuUIMessages,
  Checkbox,
  MultiSelect,
  MultiSelectItem,
  Select,
  PanelHeader
} from 'jimu-ui'
import {
  DataSourceSelector,
  AllDataSourceTypes,
  FieldSelector
} from 'jimu-ui/advanced/data-source-selector'
import { LayersConfig, SelectionModeType } from '../config'
import defaultMessages from './translations/default'
import { Fragment } from 'react'

const { OUTPUT_DATA_VIEW_ID } = CONSTANTS

interface Props {
  useDataSource: IMUseDataSource
  intl: IntlShape
  theme: ThemeVariables
  onClose?: () => void
  optionChange: (prop: string, value: any) => void
  dataSourceChange: (useDataSources: UseDataSource[]) => void
}

interface State {
  dataSource: QueriableDataSource
}

export default class LayerConfig extends React.PureComponent<
Props & LayersConfig,
State
> {
  supportedDsTypes = Immutable([AllDataSourceTypes.FeatureLayer])

  constructor (props) {
    super(props)

    this.state = {
      dataSource: undefined
    }
  }

  nameChange = event => {
    if (event && event.target && event.target.value) {
      const value = event.target.value.trim()
      this.props.optionChange('name', value)
    }
  }

  handleCheckboxChange = evt => {
    const target = evt.currentTarget
    if (!target) return
    this.props.optionChange(target.dataset.field, target.checked)
  }

  formatMessage = (id: string, values?: { [key: string]: any }) => {
    const messages = Object.assign({}, defaultMessages, jimuUIMessages)
    return this.props.intl.formatMessage(
      { id: id, defaultMessage: messages[id] },
      values
    )
  }

  displaySelectedFields = values => {
    return this.formatMessage('countSelected', { selectedCount: values.length })
  }

  onFieldChange = (allSelectedFields: IMFieldSchema[]) => {
    if (allSelectedFields.length === 0) return
    this.props.optionChange('tableFields', allSelectedFields)
  }

  onDataSourceCreated = (dataSource: QueriableDataSource): void => {
    this.setState({ dataSource })
  }

  getSearchingFields = (isSearch: boolean): MultiSelectItem[] => {
    const { dataSource } = this.state
    if (dataSource) {
      const scheme = dataSource.getSchema()
      if (scheme && scheme.fields) {
        const res = []
        Object.keys(scheme.fields).forEach(fieldKey => {
          const field = scheme.fields[fieldKey]
          if (isSearch) {
            if (field.type == JimuFieldType.String) {
              res.push({
                value: fieldKey,
                label:
                  scheme.fields[fieldKey].alias || scheme.fields[fieldKey].name
              })
            }
          } else {
            res.push({
              value: fieldKey,
              label:
                scheme.fields[fieldKey].alias || scheme.fields[fieldKey].name
            })
          }
        })
        return res
      }
    }
    return []
  }

  handleChooseSearchingFieldsChange = (evt, value, values) => {
    this.props.optionChange('searchFields', values.join(','))
  }

  getSelectModeOptions = (): JSX.Element[] => {
    return [
      <option key={SelectionModeType.Single} value={SelectionModeType.Single}>
        {this.formatMessage('single')}
      </option>,
      <option
        key={SelectionModeType.Multiple}
        value={SelectionModeType.Multiple}
      >
        {this.formatMessage('multiple')}
      </option>
    ]
  }

  getStyle (theme: ThemeVariables): SerializedStyles {
    return css`
      .layer-config-panel {
        .panel-inner {
          .title {
            max-width: 70%;
          }
        }
        .setting-container {
          height: calc(100% - ${polished.rem(58)});
          overflow: auto;
          .table-options {
            .table-options-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .select-option {
              margin-bottom: 8px;
            }
          }
          .ds-container {
            position: absolute;
            display: none;
          }
          .component-field-selector {
            .search-input {
              width: 100%;
            }
            .field-list {
              max-height: 300px;
            }
          }
          .config-word-break {
            word-break: break-all;
          }
        }
      }
    `
  }

  render () {
    const {
      useDataSource,
      optionChange,
      theme,
      tableFields,
      searchFields
    } = this.props
    const { dataSource } = this.state
    const layerDefinition =
      dataSource && (dataSource as FeatureLayerDataSource).getLayerDefinition()
    const optionsArray = ['enableSelect', 'enableRefresh'] // 'allowCsv',
    const _tableFields: string[] = []
    if (tableFields && tableFields.length > 0) {
      tableFields.map(item => {
        _tableFields.push(item.jimuName)
      })
    }
    // Can't edit Feature collection(dataSource.url is undefined) and output ds
    const capabilities = layerDefinition?.capabilities
    let editing = false
    if(capabilities) {
      editing = Array.isArray(capabilities) ? capabilities.join().toLowerCase().includes('editing')
        : layerDefinition?.capabilities.toLowerCase().includes('editing')
    }
    const editAble =
      dataSource?.url &&
      dataSource?.dataViewId !== OUTPUT_DATA_VIEW_ID &&
      editing

    return (
      <div className='w-100 h-100' css={this.getStyle(theme)}>
        <div className='w-100 h-100 layer-config-panel'>
          <div className="w-100 jimu-widget-setting--header d-flex px-3 py-0">
            <PanelHeader
              level={1}
              className='py-3 panel-inner'
              showClose={!!this.props.onClose}
              onClose={this.props.onClose}
              title={this.formatMessage('layerConfig')}>
            </PanelHeader>
          </div>
          <div className='setting-container'>
            <SettingSection title={this.formatMessage('data')} className="pt-0">
              <SettingRow>
                <DataSourceSelector
                  types={this.supportedDsTypes}
                  disableRemove={() => true}
                  useDataSources={
                    useDataSource ? Immutable([useDataSource]) : Immutable([])
                  }
                  mustUseDataSource
                  onChange={this.props.dataSourceChange}
                  closeDataSourceListOnChange
                />
              </SettingRow>
            </SettingSection>

            {useDataSource &&
              <React.Fragment>
                <SettingSection title={this.formatMessage('label')}>
                  <SettingRow>
                    <TextInput
                      type='text'
                      className='w-100'
                      value={this.props.name ? this.props.name : ''}
                      onChange={this.nameChange}
                    />
                  </SettingRow>
                </SettingSection>

                <SettingSection title={this.formatMessage('configFields')}>
                  <SettingRow>{this.formatMessage('configTips')}</SettingRow>
                  <SettingRow>
                    <FieldSelector
                      useDataSources={
                        useDataSource ? Immutable([useDataSource]) : Immutable([])
                      }
                      onChange={this.onFieldChange}
                      selectedFields={Immutable(_tableFields)}
                      isMultiple
                      isSearchInputHidden={false}
                      isDataSourceDropDownHidden
                    />
                  </SettingRow>
                  {/* {layerDefinition?.hasAttachments &&
                    <SettingRow>
                      <div className="d-flex w-100">
                        <Checkbox
                          data-field="enableAttachements"
                          onClick={this.handleCheckboxChange}
                          checked={this.props.enableAttachements} />
                        <div className="ml-2 config-word-break" title={this.formatMessage('enableAttachements')}>{this.formatMessage('enableAttachements')}</div>
                      </div>
                    </SettingRow>
                  } */}
                  {editAble && (
                      <SettingRow>
                      <div className='d-flex w-100'>
                        <Checkbox
                          data-field='enableEdit'
                          onClick={this.handleCheckboxChange}
                          checked={this.props.enableEdit}
                        />
                        <div
                          className='ml-2'
                          title={this.formatMessage('enableEdit')}
                        >
                          {this.formatMessage('enableEdit')}
                        </div>
                      </div>
                    </SettingRow>
                  )}
                </SettingSection>

                <SettingSection title={this.formatMessage('tools')}>
                  <div className='w-100 table-options'>
                    <div className='table-options-item' key='enableSearch'>
                      <span className='text-break' style={{ width: '80%' }}>
                        {this.formatMessage('enableSearch')}
                      </span>
                      <Switch
                        className='can-x-switch'
                        checked={this.props.enableSearch || false}
                        onChange={evt => {
                          optionChange('enableSearch', evt.target.checked)
                        }}
                      />
                    </div>
                  </div>
                  <div className='ds-container'>
                    <DataSourceComponent
                      useDataSource={Immutable(useDataSource)}
                      onDataSourceCreated={this.onDataSourceCreated}
                    />
                  </div>
                  {this.props.enableSearch && (
                    <SettingRow
                      flow='wrap'
                      label={this.formatMessage('searchFields')}
                    >
                      <div
                        className='d-flex w-100 search-container'
                        style={{ zIndex: 3 }}
                      >
                        <MultiSelect
                          items={Immutable(this.getSearchingFields(true))}
                          values={
                            searchFields ? Immutable(searchFields.split(',')) : Immutable([])
                          }
                          className='search-multi-select'
                          fluid
                          onClickItem={this.handleChooseSearchingFieldsChange}
                          displayByValues={this.displaySelectedFields}
                        />
                      </div>
                      <div className='d-flex w-100' style={{ marginTop: '10px' }}>
                        <Checkbox
                          data-field='searchExact'
                          onClick={this.handleCheckboxChange}
                          checked={this.props.searchExact}
                        />
                        <div
                          className='ml-2 config-word-break'
                          title={this.formatMessage('fullMatch')}
                        >
                          {this.formatMessage('fullMatch')}
                        </div>
                      </div>
                    </SettingRow>
                  )}
                  <SettingRow>
                    <div className='w-100 table-options'>
                      {optionsArray.map((key, index) => {
                        return (
                          <Fragment key={index}>
                            <div className='table-options-item'>
                              <span
                                className='text-break'
                                style={{ width: '80%' }}
                              >
                                {this.formatMessage(key)}
                              </span>
                              <Switch
                                className='can-x-switch'
                                checked={this.props[key] || false}
                                onChange={evt => {
                                  optionChange(key, evt.target.checked)
                                }}
                              />
                            </div>
                            {key === 'enableSelect' && this.props[key] && (
                              <SettingRow
                                flow='wrap'
                                label={this.formatMessage('selectMode')}
                                className='select-option'
                              >
                                <Select
                                  value={
                                    this.props.selectMode ||
                                    SelectionModeType.Multiple
                                  }
                                  onChange={evt => {
                                    optionChange('selectMode', evt.target.value)
                                  }}
                                >
                                  {this.getSelectModeOptions()}
                                </Select>
                              </SettingRow>
                            )}
                          </Fragment>
                        )
                      })}
                    </div>
                  </SettingRow>
                </SettingSection>
              </React.Fragment>
            }
          </div>
        </div>
      </div>
    )
  }
}
