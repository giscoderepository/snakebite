/** @jsx jsx */
import {
  React,
  jsx,
  AllWidgetProps,
  classNames,
  ThemeVariables,
  SerializedStyles,
  css,
  DataSourceComponent,
  QueriableDataSource,
  Immutable,
  appActions,
  lodash,
  QueryParams,
  MessageManager,
  DataRecordsSelectionChangeMessage,
  ClauseValuePair,
  ReactResizeDetector,
  Global,
  DataSourceInfo,
  IMDataSourceInfo,
  getAppStore,
  CONSTANTS,
  DataSourceStatus,
  IMState,
  dataSourceUtils,
  MutableStoreManager,
  DataSourceManager,
  DataRecord,
  appConfigUtils,
  QueryScope,
  WidgetState,
  FieldSchema,
  ImmutableObject
} from 'jimu-core'
import {
  IMConfig,
  LayersConfig,
  SelectionModeType,
  TableArrangeType
} from '../config'
import {
  loadArcGISJSAPIModules,
  FeatureDataRecord,
  FeatureLayerDataSource
} from 'jimu-arcgis'
import defaultMessages from './translations/default'
import {
  WidgetPlaceholder,
  defaultMessages as jimuUIDefaultMessages,
  Button,
  Icon,
  TextInput,
  Tabs,
  Tab,
  Select,
  AdvancedSelect,
  Popper,
  DataActionDropDown,
  _Alert
} from 'jimu-ui'

const { BREAK_POINTS, SELECTION_DATA_VIEW_ID } = CONSTANTS
const showSelectedOnlyIcon = require('jimu-ui/lib/icons/show-selected-only.svg')
const showSelectedIconRTL = require('jimu-ui/lib/icons/show-selected-only-rtl.svg')
const showAllIcon = require('jimu-ui/lib/icons/show-all.svg')
const uncheckAllIcon = require('jimu-ui/lib/icons/uncheck-all.svg')
const resetIcon = require('jimu-ui/lib/icons/reset.svg')
const showHideIcon = require('jimu-ui/lib/icons/show-hide-cols.svg')
const IconClose = require('jimu-ui/lib/icons/close.svg')
const tablePlaceholderIcon = require('./assets/icons/placeholder-table.svg')
const SEARCH_TOOL_MIN_SIZE = 220
// Due to API limitations, the icon color of the drop-down menu requires special treatment
const showSelectedOnlyWhiteIcon = require('jimu-ui/lib/icons/show-selected-only-white.svg')
const showSelectedWhiteIconRTL = require('jimu-ui/lib/icons/show-selected-only-rtl-white.svg')
const showAllWhiteIcon = require('jimu-ui/lib/icons/show-all-white.svg')
const uncheckAllWhiteIcon = require('jimu-ui/lib/icons/uncheck-all-white.svg')
const resetWhiteIcon = require('jimu-ui/lib/icons/reset-white.svg')
const showHideWhiteIcon = require('jimu-ui/lib/icons/show-hide-cols-white.svg')
const notLoad = [DataSourceStatus.NotReady, DataSourceStatus.LoadError]

export interface Props {
  dataSourcesInfo?: { [dsId: string]: DataSourceInfo }
  isRTL: boolean
  currentPageId: string
  viewInTableObj: { [id: string]: LayersConfig }
  enableDataAction: boolean
  belongToDataSourceInfos: any
}

export interface State {
  apiLoaded: boolean
  dataSource: QueriableDataSource
  activeTabId: string
  downloadOpen: boolean
  searchText: string
  selectQueryFlag: boolean
  mobileFlag: boolean
  searchToolFlag: boolean
  tableShowColumns: ClauseValuePair[]
  isOpenSearchPopper: boolean
  emptyTable: boolean
  selectRecords: DataRecord[]
  notReady: boolean
  selfDsChange: boolean
  advancedField: ImmutableObject<FieldSchema>
  advancedTableField: {
    value: string
    label: string
  }[]
}

export default class Widget extends React.PureComponent<
AllWidgetProps<IMConfig> & Props,
State
> {
  table: __esri.FeatureTable
  dataSourceChange: boolean
  dataActionCanLoad: boolean
  dropdownCsv: any
  refs: {
    tableContainer: HTMLInputElement
    advancedSelect: HTMLElement
    searchPopup: HTMLDivElement
    currentEl: HTMLElement
  }
  updatingTable: boolean
  removeConfig: boolean
  debounceOnResize: (width, height) => void
  FeatureTable: typeof __esri.FeatureTable = null
  FeatureLayer: typeof __esri.FeatureLayer = null

  static mapExtraStateProps = (
    state: IMState,
    props: AllWidgetProps<IMConfig>
  ): Props => {
    const currentWidget = state?.appConfig?.widgets?.[props.id]
    const enableDataAction = currentWidget?.enableDataAction
    const dsIds = currentWidget?.useDataSources?.map(dsJson => {
      return dsJson.dataSourceId
    })
    const dataInstance = DataSourceManager.getInstance()
    const belongToDataSourceInfos = {}
    dsIds?.forEach(dsId => {
      const belongToDs = dataInstance.getDataSource(dsId)?.belongToDataSource
      belongToDataSourceInfos[dsId] = state?.dataSourcesInfo?.[belongToDs?.id]
    })
    return {
      isRTL: state?.appContext?.isRTL,
      currentPageId: state?.appRuntimeInfo?.currentPageId,
      viewInTableObj: props?.mutableStateProps?.viewInTableObj,
      enableDataAction: enableDataAction === undefined ? true : enableDataAction,
      belongToDataSourceInfos
    }
  }

  constructor (props) {
    super(props)

    this.state = {
      apiLoaded: false,
      dataSource: undefined,
      activeTabId: undefined,
      downloadOpen: false,
      searchText: '',
      selectQueryFlag: false,
      mobileFlag: false,
      searchToolFlag: false,
      tableShowColumns: undefined,
      isOpenSearchPopper: false,
      emptyTable: false,
      selectRecords: [],
      notReady: false,
      selfDsChange: false,
      advancedField: undefined,
      advancedTableField: []
    }
    this.dataSourceChange = false
    this.dataActionCanLoad = true
    this.updatingTable = false
    this.removeConfig = false
    this.debounceOnResize = lodash.debounce(
      (width, height) => this.onToolStyleChange(width, height),
      200
    )
  }

  static getDerivedStateFromProps (nextProps, prevState) {
    const { config } = nextProps
    const { layersConfig } = config
    const { activeTabId } = prevState
    // data-action Table
    const daLayersConfig = new Widget(nextProps).getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    if ((!activeTabId || allLayersConfig.findIndex(x => x.id === activeTabId) < 0) && allLayersConfig.length > 0) {
      const curConfig = allLayersConfig.find(
        item => item.id === allLayersConfig[0]?.id
      )
      const newAdvancedField = curConfig && curConfig.allFields[0]
      const newAdvancedTableField = curConfig && curConfig.tableFields.map(item => {
        return { value: item.name, label: item.alias }
      })
      return {
        activeTabId: allLayersConfig[0]?.id,
        advancedField: newAdvancedField,
        advancedTableField: newAdvancedTableField
      }
    }
    return null
  }

  componentDidMount () {
    if (!this.state.apiLoaded) {
      loadArcGISJSAPIModules([
        'esri/widgets/FeatureTable',
        'esri/layers/FeatureLayer'
      ]).then(modules => {
        ;[this.FeatureTable, this.FeatureLayer] = modules
        this.setState({
          apiLoaded: true
        })
        this.createTable()
      })
    }
  }

  componentWillUnmount () {
    if (this.table) {
      (this.table as any).menu.open = false
    }
  }

  componentDidUpdate (prevProps, prevState) {
    const { activeTabId, dataSource } = this.state
    const { id, config, currentPageId, state, belongToDataSourceInfos } = this.props
    const { layersConfig } = config
    const daLayersConfig = this.getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    const removeLayerFlag = this.props?.stateProps?.removeLayerFlag || false
    const dataActionActiveObj = this.props?.stateProps?.dataActionActiveObj
    const newActiveTabId = dataActionActiveObj?.dataActionTable ? dataActionActiveObj?.activeTabId : activeTabId
    if (removeLayerFlag) {
      const popover = document.getElementsByClassName(
        'esri-popover esri-popover--open'
      )
      if (popover && popover.length > 0) popover[0].remove()
      this.props.dispatch(
        appActions.widgetStatePropChange(id, 'removeLayerFlag', false)
      )
    }
    // close table menu
    const controllerClose = state === WidgetState.Closed
    const pageClose = prevProps.currentPageId !== currentPageId
    if ((controllerClose || pageClose) && this.table) {
      (this.table as any).menu.open = false
    }
    const prevCurConfig = prevProps.config.layersConfig.concat(daLayersConfig).find(
      item => item.id === prevState.activeTabId
    )
    const newCurConfig = allLayersConfig.find(
      item => item.id === newActiveTabId
    )
    if (this.removeConfig) {
      this.removeConfig = false
      if (!newCurConfig) return
    } else {
      if (!prevCurConfig || !newCurConfig) return
    }
    // table advanced selector
    const newAdvancedTableField = newCurConfig.tableFields?.map(item => {
      return { value: item.name, label: item.alias }
    })
    if (newActiveTabId !== prevState.activeTabId) {
      this.setState({
        advancedField: newCurConfig.allFields?.[0],
        advancedTableField: newAdvancedTableField
      })
    }
    const optionKeys = [
      'enableAttachements',
      'enableEdit',
      'allowCsv',
      'enableSearch',
      'searchFields',
      'enableRefresh',
      'enableSelect',
      'selectMode',
      'tableFields'
    ]
    let optionChangeFlag = false
    for (const i in optionKeys) {
      const item = optionKeys[i]
      const changeFlag = item !== 'tableFields' ? (prevCurConfig?.[item] !== newCurConfig?.[item]) : !lodash.isDeepEqual(prevCurConfig?.[item], newCurConfig?.[item])
      if (changeFlag) {
        optionChangeFlag = true
        break
      }
    }
    // belongToDataSource info change (update geometry and sql)
    const preDsId = prevCurConfig?.useDataSource?.dataSourceId
    const curDsId = newCurConfig?.useDataSource?.dataSourceId
    const preBelongToWidgetQuery = prevProps?.belongToDataSourceInfos?.[preDsId]?.widgetQueries
    const curBelongToWidgetQuery = belongToDataSourceInfos?.[curDsId]?.widgetQueries
    const curBelongToDsStatus = belongToDataSourceInfos?.[curDsId]?.status
    const dsParam: any = dataSource && dataSource.getCurrentQueryParams()
    // changes are only caused by belongtoDataSource
    if (preDsId === curDsId && preBelongToWidgetQuery !== curBelongToWidgetQuery) {
      this.updateGeometryAndSql(dataSource, dsParam)
    }
    const needUpdateTable = () => {
      const dsReady = !notLoad.includes(curBelongToDsStatus)
      const tabChange = dsReady && prevCurConfig?.id !== newCurConfig?.id
      const tableOptionChange = dsReady && prevCurConfig?.id === newCurConfig?.id && optionChangeFlag
      return !this.updatingTable && (tabChange || tableOptionChange)
    }
    if (dataActionActiveObj?.dataActionTable && this.dataActionCanLoad && !this.updatingTable) {
      this.dataActionCanLoad = false
      this.props.dispatch(
        appActions.widgetStatePropChange(id, 'dataActionActiveObj', { activeTabId: newActiveTabId, dataActionTable: false })
      )
      this.updatingTable = true
      this.setState(
        {
          activeTabId: newActiveTabId,
          searchText: '',
          tableShowColumns: undefined
        },
        () => {
          this.destoryTable().then(() => {
            this.createTable()
          })
        }
      )
      return
    }
    if (needUpdateTable()) {
      this.updatingTable = true
      this.setState(
        {
          searchText: '',
          tableShowColumns: undefined
        },
        () => {
          this.destoryTable().then(() => {
            this.createTable()
          })
        }
      )
    }
  }

  onToolStyleChange = (width, height) => {
    width < BREAK_POINTS[0]
      ? this.setState({ mobileFlag: true })
      : this.setState({ mobileFlag: false })
    width < SEARCH_TOOL_MIN_SIZE
      ? this.setState({ searchToolFlag: true })
      : this.setState({ searchToolFlag: false })
  }

  subSet = (array1, array2) => {
    const arr1 = array1.map(JSON.stringify)
    const arr2 = array2.map(JSON.stringify)
    return arr1
      .concat(arr2)
      .filter((v, i, arr) => {
        return arr.indexOf(v) === arr.lastIndexOf(v)
      })
      .map(JSON.parse)
  }

  onDataSourceCreated = (dataSource: QueriableDataSource): void => {
    this.setState({ dataSource })
  }

  updateGeometryAndSql = (dataSource, dsParam) => {
    if (!this.table?.layer) return
    this.table.layer.definitionExpression = dsParam?.where
    dataSourceUtils.changeJimuFeatureLayerQueryToJSAPILayerQuery(dataSource as FeatureLayerDataSource, Immutable(dsParam)).then(res => {
      if (!res?.geometry) return
      const newGeometry = res.geometry
      const newGeometryJson = (newGeometry as any)?.toJSON()
      const orgGeometryJson = (this.table?.filterGeometry as any)?.toJSON()
      if (!lodash.isDeepEqual(orgGeometryJson, newGeometryJson)) {
        (this.table.filterGeometry as any) = newGeometry
      }
    })
  }

  onDataSourceInfoChange = (
    info: IMDataSourceInfo,
    preInfo?: IMDataSourceInfo
  ) => {
    if (!info) {
      this.destoryTable().then(() => {
        this.setState({ emptyTable: true })
      })
      return
    }
    this.dataSourceChange = true
    if (info?.status === DataSourceStatus.Loaded && preInfo?.status === DataSourceStatus.Loaded) {
      this.dataSourceChange = false
    }
    let { dataSource } = this.state
    const { selectQueryFlag, activeTabId, selfDsChange } = this.state
    const { config } = this.props
    const { layersConfig } = config
    // config info
    const daLayersConfig = this.getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    const curLayer = allLayersConfig
      .find(item => item.id === activeTabId)
    const useDS = curLayer?.useDataSource
    // If other widgets load data, status will be loaded at the first time
    // This time state.dataSource is undefined
    if ((!dataSource && useDS) || (dataSource?.id !== useDS?.dataSourceId)) {
      dataSource = DataSourceManager.getInstance().getDataSource(useDS?.dataSourceId) as QueriableDataSource
      if (!dataSource) {
        this.setState({ emptyTable: true })
        return
      }
    } else if(!dataSource && !useDS) {
      return
    }
    if (!info?.status || info?.status === DataSourceStatus.NotReady) {
      this.destoryTable().then(() => {
        this.setState({
          notReady: true,
          emptyTable: true
        })
      })
      return
    } else {
      this.setState({
        notReady: false,
        emptyTable: false
      })
    }
    // widgetQuery change (update geometry and sql)
    const dsParam: any = dataSource && dataSource.getCurrentQueryParams()
    const widgetQueryChange = info?.widgetQueries !== preInfo?.widgetQueries
    if (widgetQueryChange) {
      this.updateGeometryAndSql(dataSource, dsParam)
    }
    // shielding info change
    const preSelectedIds = preInfo?.selectedIds
    const newSelectedIds = info?.selectedIds
    const preSourceVersion = preInfo?.sourceVersion
    const newSourceVersion = info?.sourceVersion
    const newVersion = info?.gdbVersion
    const preVersion = preInfo?.gdbVersion
    const infoStatusNotChange =
      curLayer?.useDataSource?.dataSourceId === dataSource?.id &&
      preInfo?.status === info?.status &&
      preInfo?.instanceStatus === info?.instanceStatus &&
      info?.widgetQueries === preInfo?.widgetQueries &&
      preSelectedIds === newSelectedIds &&
      preSourceVersion === newSourceVersion &&
      newVersion === preVersion
    if (
      notLoad.includes(info?.status) ||
      this.updatingTable ||
      infoStatusNotChange
    ) { return }
    // data-action
    this.setState({ selectRecords: dataSource?.getSelectedRecords() })
    // version manager
    if (preVersion && newVersion && newVersion !== preVersion && this.table) {
      this.updatingTable = true
      this.destoryTable().then(() => {
        this.createTable()
      })
      return
    }
    // ds ready create table and selected features change
    const tabChange = curLayer?.useDataSource?.dataSourceId !== dataSource?.id
    const outputReapply = (!preInfo?.status || notLoad.includes(preInfo?.status)) && info && !notLoad.includes(info?.status)
    const selectedChange = preSelectedIds !== newSelectedIds && (preSelectedIds?.length !== 0 || newSelectedIds?.length !== 0)
    const infoNotChange = info?.status === preInfo?.status && info?.instanceStatus === preInfo?.instanceStatus
    const dsCreated = info?.status === DataSourceStatus.Unloaded && info?.instanceStatus === DataSourceStatus.Created && !selectedChange && !infoNotChange
    const sourceVerChange = preSourceVersion !== newSourceVersion
    if (outputReapply || tabChange || dsCreated || sourceVerChange) {
      if (!this.dataActionCanLoad) return
      this.updatingTable = true
      this.destoryTable().then(() => {
        this.createTable(dataSource)
      })
      return
    }
    // async click selected
    // Action table does not need to be selected synchronously
    if (!curLayer.dataActionObject && preSelectedIds !== newSelectedIds) {
      if (selectQueryFlag) {
        this.asyncSelectedWhenSelection(newSelectedIds || Immutable([]))
        setTimeout(() => {
          this.asyncSelectedRebuild(dataSource)
        }, 500)
      } else {
        if (selfDsChange) {
          this.setState({ selfDsChange: false })
        } else {
          setTimeout(() => {
            this.asyncSelectedRebuild(dataSource)
          }, 500)
        }
      }
    }
    // update table (exclude view in table)
    if(!curLayer.dataActionObject && this.table?.layer && preSelectedIds === newSelectedIds) {
      this.table.layer.definitionExpression = dsParam.where
    }
  }

  getLayerObjectIdField = () => {
    const { dataSource } = this.state
    const objectIdField =
      this.table?.layer?.objectIdField ||
      (dataSource as FeatureLayerDataSource)?.layer?.objectIdField ||
      'OBJECTID'
    return objectIdField
  }

  asyncSelectedWhenSelection = newSelectedIds => {
    const { dataSource } = this.state
    const objectIdField = this.getLayerObjectIdField()
    const curQuery: any = dataSource && dataSource.getCurrentQueryParams()
    let legal = true
    newSelectedIds.forEach(id => {
      if(!id) legal = false
    })
    const selectedQuery = (newSelectedIds.length > 0 && legal) ? `${objectIdField} IN (${newSelectedIds
      .map(id => {
        return id
      })
      .join()})`
      : curQuery.where
    if(newSelectedIds.length === 0) {
      this.setState({ selectQueryFlag: false })
    }
    if(this.table && this.table.layer) this.table.layer.definitionExpression = selectedQuery
  }

  getFeatureLayer = (dataSource: QueriableDataSource, dataRecordIds?: string[]) => {
    const { id } = this.props
    const ds = dataSource as FeatureLayerDataSource
    const notToLoad = dataSource?.getDataSourceJson()?.isDataInDataSourceInstance
    let featureLayer
    if(dataRecordIds && dataRecordIds.length > 0) {
      // The first time view in table, dataRecords is not load
      const dataRecordIdsNum = dataRecordIds.map(id => {
        return parseInt(id)
      })
      const actionQuery = { objectIds:dataRecordIdsNum, where: '1=1' } as QueryParams
      return dataSource.query(actionQuery, { scope: QueryScope.InAllData }).then(async (res) => {
        const dataRecords = await Promise.resolve(res?.records) as FeatureDataRecord[]
        return dataSourceUtils.createFeatureLayerByRecords(ds, dataRecords)
      })
    } else {
      const curQuery: any = dataSource && dataSource.getCurrentQueryParams()
      if (notToLoad) {
        // chart output and selected features need load
        return ds.load({ returnGeometry: true }, { widgetId: id }).then(async (records) => {
          const dataRecords = await Promise.resolve(records) as FeatureDataRecord[]
          return dataSourceUtils.createFeatureLayerByRecords(ds, dataRecords)
        })
      }
      // Adjust the order, because ds.layer is a reference type that changes the original data
      // csv upload type ds: only have layer, but not itemId and url
      if (!this.FeatureLayer) return Promise.resolve(featureLayer)
      if (ds.itemId) {
        const layerId = parseInt(ds.layerId)
        const layerConfig = {
          portalItem: {
            id: ds.itemId,
            portal: {
              url: ds.portalUrl
            }
          },
          definitionExpression: curQuery.where,
          layerId: layerId ? layerId : undefined
        }
        if (ds.url) layerConfig['url'] = ds.url
        featureLayer = new this.FeatureLayer(layerConfig)
      } else if (ds.url) {
        featureLayer = new this.FeatureLayer({
          definitionExpression: curQuery.where,
          url: ds.url
        })
      } else if (ds.layer) {
        return ds.load({ returnGeometry: true }, { widgetId: id }).then(async (records) => {
          const dataRecords = await Promise.resolve(records) as FeatureDataRecord[]
          return dataSourceUtils.createFeatureLayerByRecords(ds, dataRecords)
        })
      } else {
        return Promise.resolve(featureLayer)
      }
    }
    if(notToLoad) { // output ds (dynamic layer, load will rise bug)
      return Promise.resolve(featureLayer)
    } else { // need load to get layer.capabilities
      return featureLayer.load().then(async () => {
        return await Promise.resolve(featureLayer)
      })
    }
  }

  createTable = (newDataSource?) => {
    const { config, id } = this.props
    const { layersConfig } = config
    const { activeTabId } = this.state
    let { dataSource } = this.state
    if (!dataSource && newDataSource) dataSource = newDataSource
    // ds judgment
    if (dataSource?.dataViewId === SELECTION_DATA_VIEW_ID) {
      if (!dataSource?.getDataSourceJson()?.isDataInDataSourceInstance ||
        dataSource?.getSourceRecords().length === 0
      ) {
        this.setState({ emptyTable: true })
        this.dataSourceChange = false
        this.dataActionCanLoad = true
        this.updatingTable = false
        return
      } else {
        this.setState({ emptyTable: false })
      }
    }
    // data-action Table
    const daLayersConfig = this.getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    const curLayer = allLayersConfig
      .find(item => item.id === activeTabId)
    if (!curLayer) return
    let container
    if (document.getElementsByClassName(`table-container-${id}`).length === 0) {
      container = document && document.createElement('div')
      container.className = `table-container-${id}`
      this.refs.tableContainer &&
        this.refs.tableContainer.appendChild(container)
    } else {
      container = document.getElementsByClassName(`table-container-${id}`)[0]
    }
    const invisibleColumns = this.subSet(
      curLayer.allFields,
      curLayer.tableFields
    ).map(item => {
      return item.jimuName
    })
    const fieldConfigs = curLayer.tableFields.map(item => {
      return {
        name: item.jimuName,
        label: item.alias,
        visible: invisibleColumns.indexOf(item.jimuName) < 0
      }
    })
    let tableMenuItem = []
    if (curLayer.enableSelect) {
      tableMenuItem = tableMenuItem.concat([
        {
          label: this.formatMessage('showSelection'),
          iconClass: 'widget-table-tool-icon-show-selection',
          clickFunction: () => {
            this.onShowSelection()
          }
        },
        {
          label: this.formatMessage('clearSelection'),
          iconClass: 'widget-table-tool-icon-selection-clear',
          clickFunction: () => {
            this.onSelectionClear()
          }
        }
      ])
    }
    if (curLayer.enableRefresh) {
      tableMenuItem.push({
        label: this.formatMessage('refresh'),
        iconClass: 'widget-table-tool-icon-refresh',
        clickFunction: () => {
          this.onTableRefresh()
        }
      })
    }
    tableMenuItem.push({
      label: this.formatMessage('showHideCols'),
      iconClass: 'widget-table-tool-icon-show-hide-cols',
      clickFunction: () => {
        this.popupShowHideCols()
      }
    })

    const dataActionObject = curLayer.dataActionObject
    let dataRecords = undefined
    if (dataActionObject) {
      dataRecords = dataActionObject.dataActionRecordIds
      const dsId = curLayer.useDataSource?.dataSourceId
      if (dsId) {
        dataSource = DataSourceManager.getInstance().getDataSource(dsId) as QueriableDataSource
      }
    }
    dataSource &&
      this.getFeatureLayer(dataSource, dataRecords).then(layer => {
        if (!layer) return
        if (!this.FeatureTable) return
        let featureLayer
        if (layer.layer) {
          featureLayer = layer.layer
        } else {
          featureLayer = layer
        }
        if(!this.refs.currentEl) return
        let editable = false
        if (featureLayer.capabilities) {
          editable = curLayer.enableEdit &&
            featureLayer.capabilities?.editing?.supportsUpdateByOthers
        }
        const objectIdField = this.getLayerObjectIdField()
        if (editable) {
          const layerObjectIdField = featureLayer?.objectIdField
          featureLayer.on('edits', function(event) {
            const { addedFeatures, updatedFeatures, deletedFeatures } = event
            // There are no add and delete for now
            const adds = addedFeatures && addedFeatures.length > 0
            const updates = updatedFeatures && updatedFeatures.length > 0
            const deletes = deletedFeatures && deletedFeatures.length > 0
            if ( adds || updates || deletes) {
              const updateFeature = event?.edits?.updateFeatures?.[0]
              const idStr = updateFeature?.attributes?.[layerObjectIdField || objectIdField]?.toString()
              const toUpdateRecord = idStr ? dataSource.getRecordById(idStr) : undefined
              if (toUpdateRecord) {
                (toUpdateRecord as FeatureDataRecord).setFeature(updateFeature)
              }
              // Tell other widgets that loaded records has changed
              dataSource.addVersion()
              // Tell other widgets that the database has changed
              dataSource.addSourceVersion()
            }
          })
        }
        const dsGdbVersion = (dataSource as FeatureLayerDataSource).getGDBVersion()
        if(dsGdbVersion) featureLayer.gdbVersion = dsGdbVersion
        this.table = new this.FeatureTable({
          layer: featureLayer,
          container: container,
          visibleElements: {
            header: true,
            menu: true,
            menuItems: {
              clearSelection: false,
              refreshData: false,
              toggleColumns: false
            }
          },
          menuConfig: {
            items: tableMenuItem
          },
          fieldConfigs,
          attachmentsEnabled: curLayer.enableAttachements,
          editingEnabled: editable
        })
        // async selected
        // Action table does not need to be selected synchronously
        if(!dataActionObject) {
          setTimeout(() => {
            this.asyncSelectedRebuild(dataSource)
          }, 500)
        }
        const tableInstant = this.table as any
        tableInstant.grid.visibleElements.selectionColumn = false
        if (curLayer.enableSelect) {
          tableInstant.grid.on('row-click', ({ context, native }) => {
            this.setState({ selfDsChange: true })
            const feature = context.item.feature
            if (curLayer.selectMode === SelectionModeType.Single) {
              this.table.clearSelection()
            }
            context.selected
              ? this.table.deselectRows(feature)
              : this.table.selectRows(feature)
            const selectedItems = tableInstant.grid?.selectedItems?.toArray()
            const objectIdField = this.getLayerObjectIdField()
            const selectedQuery =
              selectedItems && selectedItems.length > 0
                ? `${objectIdField} IN (${selectedItems
                    .map(item => {
                      return (
                        item.feature?.attributes[objectIdField] || item.objectId
                      )
                    })
                    .join()})`
                : '1=2'
            dataSource
              .query({
                where: selectedQuery,
                returnGeometry: true
              } as QueryParams)
              .then(result => {
                const records = result?.records
                if (records) {
                  MessageManager.getInstance().publishMessage(
                    new DataRecordsSelectionChangeMessage(id, result.records)
                  )
                  if (records.length > 0) {
                    dataSource.selectRecordsByIds(
                      records.map(record => record.getId()),
                      records
                    )
                  } else {
                    dataSource.clearSelection()
                  }
                }
              })
          })
        }
        this.dataSourceChange = false
        this.dataActionCanLoad = true
        this.updatingTable = false
        this.setState({ emptyTable: false })
      })
  }

  asyncSelectedRebuild = (dataSource: QueriableDataSource) => {
    const selectedRecords = dataSource && dataSource.getSelectedRecords()
    this.table?.clearSelection && this.table.clearSelection()
    // Synchronize new selection (the record of selectedRecords has different structure)
    // layer/url ds: the featuresArray's structure is not match the 'deselectRows', use primary id
    if (selectedRecords && selectedRecords.length > 0) {
      const featuresArray = []
      selectedRecords.forEach(record => {
        const recordId = record?.getId()
        if(recordId) featuresArray.push(parseInt(recordId))
      })
      this.table?.selectRows && this.table.selectRows(featuresArray)
    }
  }

  async destoryTable () {
    if (this.table) {
      (this.table as any).menu.open = false
      !this.table.destroyed && this.table.destroy()
    }
    return await Promise.resolve()
  }

  createDomStyle = (theme: ThemeVariables) => {
    const themeName = getAppStore().getState()?.appConfig?.theme
    const alreadyGrid = document.getElementById('exb-grid-styles')
    const alreadySort = document.getElementById('exb-sorter-styles')
    if (alreadyGrid) alreadyGrid.remove()
    if (alreadySort) alreadySort.remove()
    const gridDom = document && document.createElement('dom-module')
    gridDom.setAttribute('id', 'exb-grid-styles')
    gridDom.setAttribute('theme-for', 'vaadin-grid')
    const sortDom = document && document.createElement('dom-module')
    sortDom.setAttribute('id', 'exb-sorter-styles')
    sortDom.setAttribute('theme-for', 'vaadin-grid-sorter')
    let moduleCssHTML = `<template>
      <style>
        [part~="header-cell"] {
          color: ${theme.colors.palette.dark[700]};
          background-color: ${theme.colors.palette.light[100]};
        }
      </style>
    </template>`
    let moduleSortHTML = `<template>
      <style>
        :host([direction]) {
          color: ${theme.colors.palette.dark[700]};
        }
      </style>
    </template>`
    switch (themeName) {
      case 'themes/default/':
      case 'themes/shared-theme/':
      case 'themes/ink/':
        moduleCssHTML = `<template>
          <style>
            [part~="header-cell"] {
              color: ${theme.colors.palette.dark[700]};
              background-color: ${theme.colors.palette.light[100]};
            }
          </style>
        </template>`
        break
      case 'themes/dark/':
      case 'themes/morandi/':
        moduleCssHTML = `<template>
          <style>
            [part~="header-cell"] {
              color: ${theme.colors.palette.dark[700]};
              background-color: ${theme.colors.palette.light[300]};
            }
          </style>
        </template>`
        moduleSortHTML = `<template>
          <style>
            :host([direction]) {
              color: ${theme.colors.palette.dark[700]};
            }
          </style>
        </template>`
        break
      case 'themes/vivid/':
        moduleCssHTML = `<template>
          <style>
            [part~="header-cell"] {
              color: ${theme.colors.palette.dark[700]};
              background-color: ${theme.colors.palette.light[200]};
            }
          </style>
        </template>`
        moduleSortHTML = `<template>
          <style>
            :host([direction]) {
              color: ${theme.colors.palette.dark[700]};
            }
          </style>
        </template>`
        break
    }
    gridDom.innerHTML = moduleCssHTML
    sortDom.innerHTML = moduleSortHTML
    document.head.appendChild(gridDom)
    document.head.appendChild(sortDom)
  }

  formatMessage = (id: string, values?: { [key: string]: any }) => {
    const messages = Object.assign({}, defaultMessages, jimuUIDefaultMessages)
    return this.props.intl.formatMessage(
      { id: id, defaultMessage: messages[id] },
      values
    )
  }

  onTagClick = (dataSourceId: string) => {
    const { id } = this.props
    this.setState({
      activeTabId: dataSourceId,
      selectQueryFlag: false,
      tableShowColumns: undefined
    })
    this.props.dispatch(
      appActions.widgetStatePropChange(id, 'activeTabId', dataSourceId)
    )
  }

  handleTagChange = evt => {
    const dataSourceId = evt?.target?.value
    const { id } = this.props
    this.setState({
      activeTabId: dataSourceId,
      selectQueryFlag: false
    })
    this.props.dispatch(
      appActions.widgetStatePropChange(id, 'activeTabId', dataSourceId)
    )
  }

  onShowSelection = () => {
    const { dataSource, selectQueryFlag } = this.state
    if (selectQueryFlag) {
      const curQuery: any = dataSource && dataSource.getCurrentQueryParams()
      this.table.layer.definitionExpression = curQuery.where
      // change menuConfig
      const menuConfigItems = this.table.menuConfig?.items || []
      if (menuConfigItems.length > 0) {
        menuConfigItems[0].label = this.formatMessage('showSelection')
        menuConfigItems[0].iconClass = 'widget-table-tool-icon-show-selection'
      }
      this.table.menuConfig = {
        items: menuConfigItems
      }
    } else {
      const selectedArray = (this.table as any).grid.selectedItems.items
      if (selectedArray.length === 0) return
      const objectIdField = this.getLayerObjectIdField()
      const selectedQuery = `${objectIdField} IN (${selectedArray
        .map(item => {
          return item.feature?.attributes[objectIdField] || item.objectId
        })
        .join()})`
      this.table.layer.definitionExpression = selectedQuery
      // change menuConfig
      const menuConfigItems = this.table.menuConfig?.items || []
      if (menuConfigItems.length > 0) {
        menuConfigItems[0].label = this.formatMessage('showAll')
        menuConfigItems[0].iconClass = 'widget-table-tool-icon-show-all'
      }
      this.table.menuConfig = {
        items: menuConfigItems
      }
    }
    setTimeout(() => {
      this.asyncSelectedRebuild(dataSource)
    }, 500)
    this.setState({ selectQueryFlag: !selectQueryFlag })
  }

  onSelectionClear = () => {
    const { id } = this.props
    const { dataSource } = this.state
    this.table && this.table.clearSelection()
    dataSource.clearSelection()
    MessageManager.getInstance().publishMessage(
      new DataRecordsSelectionChangeMessage(id, [])
    )
  }

  onTableRefresh = () => {
    const { id } = this.props
    const { selectQueryFlag, dataSource } = this.state
    if (selectQueryFlag) {
      this.setState({
        selectQueryFlag: false,
        selfDsChange: true
      })
    }
    this.table && this.table.clearSelection()
    this.setState({ searchText: '' })
    dataSource.updateQueryParams({where: '1=1'} as QueryParams, id)
    dataSource.clearSelection()
    this.table && this.table.refresh()
  }

  popupShowHideCols = () => {
    const advancedElement = this.refs.advancedSelect.getElementsByTagName(
      'button'
    )[0]
    advancedElement && advancedElement.click()
  }

  // TODO: use getArcGISSQL to update
  getQueryOptions = (curLayer: LayersConfig) => {
    let options = '1=1'
    const { useDataSources, id } = this.props
    const { searchText, dataSource } = this.state
    const useDS = useDataSources && useDataSources[0]
    if (!dataSource || !useDS) return null
    const isHosted = dataSourceUtils.isHostedService(dataSource?.url)
    const _prefix = (isHosted && dataSourceUtils.containsNonLatinCharacter(searchText)) ? 'N' : ''
    // not queryiable data source, return
    if (!(dataSource).query) {
      return null
    }
    // searchText
    if (!searchText) {
      return dataSource.getRealQueryParams(
        { where: options } as QueryParams,
        'load',
        { widgetId: id }
      )
    }
    if (curLayer.enableSearch && curLayer.searchFields) {
      options = (options || '1=1') + ' AND '
      options += `(${curLayer.searchFields
        .split(',')
        .map(field => {
          if (curLayer.searchExact) {
            return `LOWER(${field}) = ${_prefix}'${searchText.trim().toLowerCase()}'`
          } else {
            return `LOWER(${field}) LIKE ${_prefix}'%${searchText.trim().toLowerCase()}%'`
          }
        })
        .join(' OR ')})`
    }
    return dataSource.getRealQueryParams(
      { where: options } as QueryParams,
      'load',
      { widgetId: id }
    )
  }

  handleChange = searchText => {
    if (!searchText) {
      this.setState({ searchText }, () => {
        this.handleSubmit()
      })
    } else {
      this.setState({ searchText })
    }
  }

  handleSubmit = () => {
    const { dataSource } = this.state
    const { id } = this.props
    const curLayer = this.props.config.layersConfig.find(
      item => item.id === this.state.activeTabId
    )
    const realQuery = this.getQueryOptions(curLayer)
    dataSource.updateQueryParams(realQuery, id)
    if(this.table?.layer) this.table.layer.definitionExpression = (realQuery as any).where
  }

  onKeyUp = evt => {
    if (!evt || !evt.target) return
    if (evt.keyCode === 13) {
      this.handleSubmit()
    }
  }

  renderSearchTools = () => {
    const { searchText, searchToolFlag, isOpenSearchPopper } = this.state
    const { theme } = this.props

    return (
      <div className='table-search-div'>
        {searchToolFlag ? (
          <div
            className='float-right'
            ref={ref => (this.refs.searchPopup = ref)}
          >
            <Button
              type='tertiary'
              icon
              size='sm'
              className='tools-menu'
              title={this.formatMessage('search')}
              onClick={evt => {
                this.setState({ isOpenSearchPopper: !isOpenSearchPopper })
              }}
            >
              <Icon icon={require('jimu-ui/lib/icons/search-16.svg')} />
            </Button>
            <Popper
              placement='right-start'
              reference={this.refs.searchPopup}
              offset={[-10, -30]}
              open={isOpenSearchPopper}
              showArrow={false}
              toggle={e => {
                this.setState({ isOpenSearchPopper: !isOpenSearchPopper })
              }}
            >
              <div className='d-flex align-items-center table-popup-search m-2'>
                <Button
                  type='tertiary'
                  icon
                  size='sm'
                  onClick={evt => {
                    this.setState({ isOpenSearchPopper: false })
                  }}
                  className='search-back mr-1'
                >
                  <Icon
                    icon={require('jimu-ui/lib/icons/direction-left.svg')}
                    color={theme.colors.palette.dark[800]}
                  />
                </Button>
                <Button
                  type='tertiary'
                  icon
                  size='sm'
                  onClick={evt => this.handleSubmit()}
                  className='search-icon'
                >
                  <Icon
                    icon={require('jimu-ui/lib/icons/search-16.svg')}
                    color={theme.colors.palette.light[800]}
                  />
                </Button>
                <TextInput
                  className='popup-search-input'
                  placeholder={this.formatMessage('search')}
                  onChange={e => this.handleChange(e.target.value)}
                  value={searchText || ''}
                  onKeyDown={e => this.onKeyUp(e)}
                />
              </div>
            </Popper>
          </div>
        ) : (
          <div className='d-flex align-items-center table-search'>
            <Button
              type='tertiary'
              icon
              size='sm'
              onClick={evt => this.handleSubmit()}
              className='search-icon'
            >
              <Icon
                icon={require('jimu-ui/lib/icons/search-16.svg')}
                color={theme.colors.palette.light[800]}
              />
            </Button>
            <TextInput
              className='search-input'
              placeholder={this.formatMessage('search')}
              onChange={e => this.handleChange(e.target.value)}
              value={searchText || ''}
              onKeyDown={e => this.onKeyUp(e)}
            />
          </div>
        )}
      </div>
    )
  }

  getInitFields = () => {
    const { activeTabId } = this.state
    const { config } = this.props
    const { layersConfig } = config
    // data-action Table
    const daLayersConfig = this.getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    const curLayer = allLayersConfig.find(item => item.id === activeTabId)
    const defaultInvisible = [
      'CreationDate',
      'Creator',
      'EditDate',
      'Editor',
      'GlobalID'
    ]
    const allFields = curLayer.tableFields
    const initSelectTableFields = []
    for (const i in allFields) {
      const item = allFields[i]
      if (!defaultInvisible.includes(item.name)) {
        initSelectTableFields.push({ value: item.name, label: item.alias })
      }
    }
    return initSelectTableFields
  }

  onValueChangeFromRuntime = (valuePairs: ClauseValuePair[]) => {
    if (!valuePairs) valuePairs = []
    const { tableShowColumns } = this.state
    const initTableFields = this.getInitFields()
    const tableColumns = tableShowColumns || initTableFields
    const selectFlag = valuePairs.length > tableColumns.length
    this.subSet(tableColumns, valuePairs).map(item => {
      selectFlag
        ? this.table.showColumn(item.value)
        : this.table.hideColumn(item.value)
    })
    this.setState({ tableShowColumns: valuePairs })
  }

  getStyle = (theme: ThemeVariables): SerializedStyles => {
    const { id, enableDataAction } = this.props
    const { mobileFlag } = this.state
    const themeName = getAppStore().getState()?.appConfig?.theme
    const isViolet = themeName === 'themes/morandi/'

    return css`
      ${'&.table-widget-' + id} {
        .table-indent{
          width: calc(100% - 32px);
          height: calc(100% - 26px);
          margin: 10px 16px 16px;
          .horizontal-action-dropdown{
            position: absolute;
            right: 17px;
            top: 55px;
            padding-left: 8px;
            border-left: 1px solid ${theme.colors.palette.light[200]};
            button{
              width: 32px;
              height: 32px;
            }
          }
          .data-action-btn{
            position: relative;
            top: -1px;
            padding-left: 8px;
            border-left: 1px solid ${theme.colors.palette.light[200]};
          }
        }
        .tab-flex{
          width: 100%;
        }
        .top-drop{
          width: 30%;
          min-width: 150px;
          button{
            line-height: 1.5;
          }
        }
        .nav-underline{
          height: 32px;
          border-bottom: 1px solid ${theme.colors.palette.light[300]};
        }
        .nav-item + .nav-item{
          margin-left: 0;
        }
        .csv-dropdown-con{
          button{
            border-radius: 13px;
          }
        }
        .vertical-tag-list{
          width: 20%;
          display: inline-block;
          .tagBtn{
            width: 100%;
          }
        }
        .horizontal-tag-list{
          .tagBtn{
            width: 150px;
          }
          .tab-content{
            height: 8px;
          }
        }
        .vertical-tag-list,
        .horizontal-tag-list{
          margin-bottom: 4px;
          .activeBtn{
            color: #fff;
            background-color: #076fe5;
          }
        }
        .dropdown-tag-list{
          height: 40px;
          margin-bottom: 4px;
          .dropdown-button{
            height: 30px;
          }
        }
        .vertical-render-con{
          width: 80%;
          position: absolute;
          left: 20%;
          height: 100%;
          top: 0;
        }
        .dropdown-render-con,
        .horizontal-render-con{
          width: 100%;
          height: 100%;
        }
        .top-button-list{
          margin: 8px 0;
          position: absolute;
          right: 17px;
          top: 47px;
          ${mobileFlag && 'display: none'};
          .top-button{
            display: inline-flex;
            button{
              width: 32px;
              height: 32px;
            }
          }
        }
        .table-search-div{
          position: absolute;
          left: 20px;
          .table-search{
            .search-icon{
              z-index: 2;
            }
            .search-input{
              padding-left: 30px;
              margin-left: -30px;
            }
          }
        }
        .table-con{
          width: 100%;
          height: calc(100% - 46px);
          .esri-feature-table__loader-container{
            position: absolute;
            left: 50%;
            top: 50%;
            margin-left: -16px;
            margin-top: -20px;
            z-index: 2;
          }
          .esri-feature-table__title{
            display: none
          }
          .esri-feature-table__menu{
            position: absolute;
            right: ${enableDataAction ? '60px' : '11px'};
            top: 51px;
            ${!mobileFlag && 'display: none'};
            .esri-button-menu{
              button{
                :hover{
                  background-color: ${theme.darkTheme ? (isViolet ? theme.colors.palette.light[800] : theme.colors.palette.light[600])
                    : theme.colors.palette.light[100]};
                }
                background-color: ${theme.darkTheme ? theme.colors.palette.light[500] : theme.colors.white};
                color: ${theme.colors.black};
                border-radius: ${isViolet ? '50%' : '2px'};
                border: 1px solid ${theme.darkTheme ? theme.colors.palette.light[500] : theme.colors.palette.light[400]};
              }
            }
          }
          .esri-column__sorter{
            overflow-x: hidden;
          }
        }
        .adv-select-con{
          width: 200px;
          visibility: hidden;
          position: absolute;
          right: 17px;
          top: 56px;
        }
        .placeholder-table-con{
          height: calc(100% - 85px);
          width: 100%;
          position: relative;
          top: 40px;
          .placeholder-alert-con{
            position: absolute;
            right: 10px;
            bottom: 10px;
          }
        }
        .ds-container{
          position: absolute;
          display: none;
        }
        .dropdown-button-content{
          .table-action-option-close{
            display: none;
          }
        }
      }
    `
  }

  getGlobalTableTools = (theme: ThemeVariables, isRTL: boolean): SerializedStyles => {
    const darkTheme = theme?.darkTheme
    const selectionIcon = darkTheme ? (isRTL ? showSelectedWhiteIconRTL : showSelectedOnlyWhiteIcon)
      : (isRTL ? showSelectedIconRTL : showSelectedOnlyIcon)
    return css`
      .widget-table-tool-icon-show-selection{
        background: url('data:image/svg+xml;utf8,${encodeURIComponent(
          selectionIcon
        )}') no-repeat center;
        background-size: 100%;
        width: 16px;
        height: 16px;
      }
      .widget-table-tool-icon-show-all{
        background: url('data:image/svg+xml;utf8,${encodeURIComponent(
          darkTheme ? showAllWhiteIcon : showAllIcon
        )}') no-repeat center;
        background-size: 100%;
        width: 16px;
        height: 16px;
      }
      .widget-table-tool-icon-selection-clear{
        background: url('data:image/svg+xml;utf8,${encodeURIComponent(
          darkTheme ? uncheckAllWhiteIcon : uncheckAllIcon
        )}') no-repeat center;
        background-size: 100%;
        width: 16px;
        height: 16px;
      }
      .widget-table-tool-icon-refresh{
        background: url('data:image/svg+xml;utf8,${encodeURIComponent(
          darkTheme ? resetWhiteIcon : resetIcon
        )}') no-repeat center;
        background-size: 100%;
        width: 16px;
        height: 16px;
      }
      .widget-table-tool-icon-show-hide-cols{
        background: url('data:image/svg+xml;utf8,${encodeURIComponent(
          darkTheme ? showHideWhiteIcon : showHideIcon
        )}') no-repeat center;
        background-size: 100%;
        width: 16px;
        height: 16px;
      }
      .esri-button-menu__item .esri-button-menu__item-label{
        padding: 4px 15px !important;
      }
      .table-popup-search{
        .search-icon{
          z-index: 2;
        }
        .popup-search-input{
          padding-left: 30px;
          margin-left: -30px;
        }
      }
      .table-action-option{
        width: 100%;
        display: inline-flex;
        flex-direction: row;
        .table-action-option-tab{
          margin: auto 8px;
        }
        .table-action-option-close{
          flex: 1;
          button{
            :hover {
              color: ${theme.colors.white};
            }
            float: right;
          }
        }
      }
      .esri-popover--open{
        z-index: 1005 !important;
      }
      .jimu-dropdown-menu{
        z-index: 1006 !important;
      }
    `
  }

  getDataActionTable = () => {
    const { viewInTableObj } = this.props
    const dataActionTableArray = []
    for (const key in viewInTableObj) {
      dataActionTableArray.push({ ...viewInTableObj[key] })
    }
    return dataActionTableArray
  }

  removeActionTab = (item, evt?) => {
    const { id, viewInTableObj } = this.props
    this.removeConfig = true
    if (evt) evt.stopPropagation()
    this.setState({ tableShowColumns: undefined })
    const newViewInTableObj = viewInTableObj
    delete newViewInTableObj[item.id]
    MutableStoreManager.getInstance().updateStateValue(id, 'viewInTableObj', newViewInTableObj)
  }

  render () {
    const {
      activeTabId,
      dataSource,
      selectQueryFlag,
      tableShowColumns,
      mobileFlag,
      emptyTable,
      selectRecords,
      notReady,
      advancedField,
      advancedTableField
    } = this.state
    const { config, id, theme, isRTL, enableDataAction } = this.props
    const { layersConfig, arrangeType } = config
    // data-action Table
    const daLayersConfig = this.getDataActionTable()
    const allLayersConfig = layersConfig.asMutable({deep:true}).concat(daLayersConfig)
    let useDataSource
    const curLayer = allLayersConfig.find(item => item.id === activeTabId)
    if (allLayersConfig.length > 0) {
      useDataSource = curLayer
        ? curLayer.useDataSource
        : allLayersConfig[0].useDataSource
    }
    const classes = classNames(
      'jimu-widget',
      'widget-table',
      'surface-1',
      'table-widget-' + id
    )

    if (!useDataSource) {
      return (
        <WidgetPlaceholder
          widgetId={id}
          type='picture'
          style={{ position: 'absolute', left: 0, top: 0 }}
          icon={tablePlaceholderIcon}
        />
      )
    }

    const horizontalTag = arrangeType === TableArrangeType.Tabs
    const initSelectTableFields = this.getInitFields()
    const dataSourceLabel = dataSource?.getLabel()
    const outputDsWidgetId = appConfigUtils.getWidgetIdByOutputDataSource(useDataSource)
    const appConfig = getAppStore().getState()?.appConfig
    const widgetLabel = appConfig?.widgets?.[outputDsWidgetId]?.label
    const dataName = this.formatMessage('tableDataActionLable', { layer: (dataSource as any)?.layerDefinition?.name || '' })

    return (
      <div className={classes} css={this.getStyle(theme)} ref={el => (this.refs.currentEl = el)}>
        <div className='table-indent'>
          <div
            className={`d-flex ${
              horizontalTag ? 'horizontal-tag-list' : 'dropdown-tag-list'
            }`}
          >
            {/* someting wrong in lint check for Tabs */}
            {horizontalTag ? (
              <Tabs underline onTabSelect={this.onTagClick} className='tab-flex'>
                {
                  allLayersConfig.map(item => {
                    const isDataAction = !!item.dataActionObject
                    return (
                      <Tab
                        key={item.id}
                        id={item.id}
                        defaultActive={item.id === activeTabId}
                        active={item.id === activeTabId}
                        title={item.name}
                        className='text-truncate tag-size'
                        closeable={isDataAction}
                        onClose={() => this.removeActionTab(item)}
                      >
                        <div className='mt-2' />
                      </Tab>
                    )
                  }) as any
                }
              </Tabs>
            ) : (
              <Select
                size='sm'
                value={activeTabId}
                onChange={this.handleTagChange}
                className='top-drop'
              >
                {allLayersConfig.map(item => {
                  return (
                    <option key={item.id} value={item.id} title={item.name}>
                      <div className='table-action-option'>
                        <div className='table-action-option-tab' title={item.name}>{item.name}</div>
                        {item.dataActionObject &&
                          <div className='table-action-option-close'>
                            <Button
                              size='sm'
                              icon
                              type='tertiary'
                              onClick={(evt) => this.removeActionTab(item, evt)}
                            >
                              <Icon icon={IconClose} size={10} />
                            </Button>
                          </div>
                        }
                      </div>
                    </option>
                  )
                })}
              </Select>
            )}
          </div>
          <div
            className={`${
              arrangeType === TableArrangeType.Tabs
                ? 'horizontal-render-con'
                : 'dropdown-render-con'
            }`}
          >
            {curLayer.enableSearch &&
              curLayer.searchFields &&
              this.renderSearchTools()}
            {dataSource && mobileFlag && selectRecords && enableDataAction &&
              <div className='horizontal-action-dropdown'>
                <DataActionDropDown
                  dataName={dataName}
                  widgetId={id}
                  dataSource={dataSource}
                  records={selectRecords}
                />
              </div>
            }
            <div className='top-button-list'>
              {/* {curLayer.allowCsv &&
                <Dropdown className="csv-dropdown-con ml-2">
                  <DropdownButton size="sm" arrow={true} type="default" title={this.formatMessage('downloadCsv')}>
                    {this.formatMessage('downloadCsv')}
                  </DropdownButton>
                  <DropdownMenu>
                    <DropdownItem title={this.formatMessage('exportAll')} onClick={this.handleExportCSVAll}>
                      {this.formatMessage('exportAll')}
                    </DropdownItem>
                    <DropdownItem title={this.formatMessage('exportSelected')} onClick={this.handleExportCSVSelected}>
                      {this.formatMessage('exportSelected')}
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              } */}
              {curLayer.enableSelect && (
                <div className='top-button ml-2'>
                  <Button
                    size='sm'
                    onClick={this.onShowSelection}
                    icon
                    title={
                      selectQueryFlag
                        ? this.formatMessage('showAll')
                        : this.formatMessage('showSelection')
                    }
                  >
                    <Icon icon={selectQueryFlag ? showAllIcon : (isRTL ? showSelectedIconRTL : showSelectedOnlyIcon)} size={14} />
                  </Button>
                </div>
              )}
              {curLayer.enableSelect && (
                <div className='top-button ml-2'>
                  <Button
                    size='sm'
                    onClick={this.onSelectionClear}
                    icon
                    title={this.formatMessage('clearSelection')}
                  >
                    <Icon icon={uncheckAllIcon} size={14} />
                  </Button>
                </div>
              )}
              {curLayer.enableRefresh && (
                <div className='top-button ml-2'>
                  <Button
                    size='sm'
                    onClick={this.onTableRefresh}
                    icon
                    title={this.formatMessage('refresh')}
                  >
                    <Icon icon={resetIcon} size={14} />
                  </Button>
                </div>
              )}
              <div className='top-button ml-2'>
                <Button
                  size='sm'
                  onClick={this.popupShowHideCols}
                  icon
                  title={this.formatMessage('showHideCols')}
                >
                  <Icon icon={showHideIcon} size={14} />
                </Button>
              </div>
              {dataSource && !mobileFlag && selectRecords && enableDataAction &&
                <div className='top-button ml-2 data-action-btn'>
                  <DataActionDropDown
                    dataName={dataName}
                    widgetId={id}
                    dataSource={dataSource}
                    records={selectRecords}
                  />
                </div>
              }
            </div>
            {dataSource && (
              <div ref='advancedSelect' className='adv-select-con'>
                <AdvancedSelect
                  fluid
                  dataSource={dataSource}
                  field={advancedField}
                  codedValues={advancedTableField}
                  isMultiple
                  values={Immutable(tableShowColumns || initSelectTableFields)}
                  isEmptyOptionHidden={false}
                  onChange={this.onValueChangeFromRuntime}
                />
              </div>
            )}
            {emptyTable &&
              <div className='placeholder-table-con'>
                <WidgetPlaceholder
                  icon={require('./assets/icon.svg')}
                  message={this.formatMessage('noData')}
                />
                {notReady &&
                  <div className='placeholder-alert-con'>
                    <_Alert
                      form='tooltip'
                      size='small'
                      type='warning'
                      text={this.formatMessage('outputDataIsNotGenerated', { outputDsLabel: dataSourceLabel, sourceWidgetName: widgetLabel })}
                    />
                  </div>
                }
              </div>
            }
            <div ref='tableContainer' className='table-con' />
            <div className='ds-container'>
              <DataSourceComponent
                widgetId={id}
                useDataSource={Immutable(useDataSource)}
                onDataSourceCreated={this.onDataSourceCreated}
                onDataSourceInfoChange={this.onDataSourceInfoChange}
              />
            </div>
            <Global styles={this.getGlobalTableTools(theme, isRTL)} />
            <ReactResizeDetector
              handleWidth
              handleHeight
              onResize={this.debounceOnResize}
            />
          </div>
        </div>
      </div>
    )
  }
}
