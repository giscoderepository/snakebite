import {
  React,
  Immutable,
  appActions,
  lodash,
  BrowserSizeMode,
  getAppStore
} from 'jimu-core'
import TableWidget from '../src/runtime/widget'
import {
  mockTheme,
  wrapWidget,
  widgetRender,
  getInitState
} from 'jimu-for-test'

import { fireEvent } from '@testing-library/react'
import { SelectionModeType, TableArrangeType } from '../src/config'

jest.mock('jimu-arcgis', () => {
  return {
    loadArcGISJSAPIModules: async () => {
      return await Promise.resolve([
        function () {
          return {
            fromJSON: () => {},
            clearSelection: () => {}
          }
        },
        function () {
          return { fromJSON: () => {} }
        }
      ])
    }
  }
})

jest.mock('jimu-ui', () => {
  return {
    ...jest.requireActual('jimu-ui'),
    AdvancedSelect: jest.fn(() => <div data-testid='tableSelectTest' />)
  }
})

const initState = getInitState().merge({
  appContext: { isRTL: false },
  appConfig: {
    widgets: [] as any,
    dataSources: {
      dataSourceId: 'dataSource_1-Hydrants_8477',
      mainDataSourceId: 'dataSource_1-Hydrants_8477',
      rootDataSourceId: 'dataSource_1'
    },
    dialogs: {}
  }
})

getAppStore().dispatch(appActions.updateStoreState(initState))

describe('table test', function () {
  let render = null
  beforeAll(() => {
    render = widgetRender(getAppStore(), mockTheme as any)
  })

  afterAll(() => {
    render = null
  })

  const layerConfig = {
    id: 'test-1',
    name: 'test-table-1',
    useDataSource: {
      dataSourceId: 'dataSource_1-Hydrants_8477',
      mainDataSourceId: 'dataSource_1-Hydrants_8477',
      rootDataSourceId: 'dataSource_1'
    },
    allFields: [
      {
        jimuName: 'OBJECTID',
        name: 'OBJECTID',
        type: 'NUMBER',
        esriType: 'esriFieldTypeOID',
        alias: 'OBJECTID'
      }
    ],
    tableFields: [
      {
        jimuName: 'OBJECTID',
        name: 'OBJECTID',
        type: 'NUMBER',
        esriType: 'esriFieldTypeOID',
        alias: 'OBJECTID'
      }
    ],
    enableAttachements: false,
    enableSearch: true,
    searchFields: 'FACILITYID',
    enableEdit: false,
    enableRefresh: true,
    enableSelect: true,
    selectMode: SelectionModeType.Single,
    allowCsv: false
  }

  const config = Immutable({
    layersConfig: [layerConfig],
    arrangeType: TableArrangeType.Tabs
  })

  let props = {
    config,
    browserSizeMode: BrowserSizeMode.Large
  }

  // it('show selection/all change test', () => {
  //   const ref: { current: HTMLElement } = { current: null }
  //   const Widget = wrapWidget(TableWidget, { theme: mockTheme, ref } as any)
  //   const { getByTitle } = render(<Widget widgetId={'tableTest1'} {...props} />)
  //   const current = ref.current as any
  //   current.table = {
  //     grid: {
  //       selectedItems: {
  //         items: [
  //           {
  //             objectId: 3,
  //             feature: {
  //               attributes: {
  //                 OBJECTID: 3
  //               }
  //             }
  //           }
  //         ]
  //       }
  //     },
  //     layer: { definitionExpression: '' }
  //   }
  //   fireEvent.click(getByTitle('Show selection'))
  //   expect(current.table.layer.definitionExpression).toBe('OBJECTID IN (3)')
  //   expect(current.state.selectQueryFlag).toBe(true)
  //   expect(getByTitle('Show all')).toBeInTheDocument()
  // })

  it('different table tab with same ds should call createTable', () => {
    const newLayerConfig = lodash.assign({}, layerConfig, {
      id: 'test-2',
      name: 'test-table-2'
    })
    const mutConfig = config.asMutable({ deep: true })
    mutConfig.layersConfig.push(newLayerConfig)
    const newProps = { config: Immutable(mutConfig), dispatch: jest.fn() }
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(TableWidget, { theme: mockTheme, ref } as any)
    const { getByTitle } = render(
      <Widget widgetId='tableTest2' {...newProps} />
    )
    const current = ref.current as any
    current.destoryTable = jest.fn(() => Promise.resolve())
    fireEvent.click(getByTitle('test-table-2').children[0])
    expect(current.destoryTable).toHaveBeenCalled()
  })

  // it('remove table should clear the query', () => {
  //   const ref: { current: HTMLElement } = { current: null }
  //   const Widget = wrapWidget(TableWidget, { theme: mockTheme, ref } as any)
  //   const { rerender } = render(<Widget widgetId={'tableTest3'} {...props} />)
  //   const current = ref.current as any
  //   current.state.query = '1=1 AND (Parcel_Name LIKE "%sou%")'
  //   const mutConfig = config.asMutable({ deep: true })
  //   mutConfig.layersConfig = []
  //   const newProps = { config: Immutable(mutConfig), dispatch: jest.fn() }
  //   rerender(<Widget widgetId='tableTest3' {...newProps} />)
  //   expect(current.state.query).toBe(undefined)
  // })

  it('when sizemode is small, serch tool should be responsive', () => {
    const ref: { current: HTMLElement } = { current: null }
    const Widget = wrapWidget(TableWidget, { theme: mockTheme, ref } as any)
    const { getByTestId, getByTitle, rerender } = render(
      <Widget widgetId='tableTest4' {...props} />
    )
    const current = ref.current as any
    current.state.searchToolFlag = true
    props = lodash.assign({}, props, { browserSizeMode: BrowserSizeMode.Small })
    rerender(<Widget widgetId='tableTest4' {...props} />)
    expect(getByTitle('search')).toBeInTheDocument()
    fireEvent.click(getByTitle('search'))
    expect(getByTestId('popper')).toBeInTheDocument()
  })
})
