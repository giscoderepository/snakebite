import { AbstractDataAction, DataSource, DataRecord, utils, getAppStore, appActions, IMUseDataSource, MutableStoreManager } from 'jimu-core'
import { LayersConfig, SelectionModeType } from '../config'

export default class ViewInTable extends AbstractDataAction {
  async isSupported (dataSource: DataSource, records: DataRecord[]): Promise<boolean> {
    return records.length > 0
  }

  getDataActionRuntimeUuid = (widgetId) => {
    const runtimeUuid = utils.getLocalStorageAppKey()
    return `${runtimeUuid}-${widgetId}-DaTableArray`
  }

  deepClone = (obj: any): any => {
    const isArray = Array.isArray(obj)
    const cloneObj = isArray ? [] : {}
    for (const key in obj) {
      const isObject = (typeof obj[key] === 'object' || typeof obj[key] === 'function') && obj[key] !== null
      cloneObj[key] = isObject ? this.deepClone(obj[key]) : obj[key]
    }
    return cloneObj
  }

  async onExecute (dataSource: DataSource, records: DataRecord[], name?: string, config?: any): Promise<boolean> {
    const allFields = dataSource && dataSource.getSchema()
    const defaultInvisible = [
      'CreationDate',
      'Creator',
      'EditDate',
      'Editor',
      'GlobalID'
    ]
    const allFieldsDetails = Object.values(allFields.fields)
    const initTableFields = allFieldsDetails.filter(
      item => !defaultInvisible.includes(item.jimuName)
    )
    const newItemId = `DaTable-${utils.getUUID()}`
    const daLayerItem: LayersConfig = {
      id: newItemId,
      name: name || dataSource.getLabel(),
      useDataSource: {
        dataSourceId: dataSource.id,
        mainDataSourceId: dataSource.getMainDataSource()?.id,
        dataViewId: dataSource.dataViewId,
        rootDataSourceId: dataSource.getRootDataSource()?.id
      } as IMUseDataSource,
      allFields: allFieldsDetails,
      tableFields: initTableFields,
      enableAttachements: false,
      enableEdit: false,
      allowCsv: false,
      enableSearch: false,
      searchFields: '',
      enableRefresh: false,
      enableSelect: false,
      selectMode: SelectionModeType.Single,
      dataActionObject: {
        dataActionRecordIds: records.map(record => record?.getId())
      }
    }

    const viewInTableObj = MutableStoreManager.getInstance().getStateValue([this.widgetId])?.viewInTableObj || {}
    viewInTableObj[newItemId] = daLayerItem
    MutableStoreManager.getInstance().updateStateValue(this.widgetId, 'viewInTableObj', viewInTableObj)

    getAppStore().dispatch(
      appActions.widgetStatePropChange(this.widgetId, 'dataActionActiveObj', { activeTabId: newItemId, dataActionTable: true })
    )
    return true
  }
}
