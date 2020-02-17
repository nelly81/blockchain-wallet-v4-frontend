import * as balanceSelectors from 'components/Balances/wallet/selectors'
import { CurrenciesType } from 'core/exchange/currencies'
import { Exchange, Remote } from 'blockchain-wallet-v4/src'
import { getData as getBchAddressData } from 'components/Form/SelectBoxBchAddresses/selectors'
import { getData as getBtcAddressData } from 'components/Form/SelectBoxBtcAddresses/selectors'
import {
  getErc20Data as getErc20AddressData,
  getEthData as getEthAddressData
} from 'components/Form/SelectBoxEthAddresses/selectors'
import { getData as getXlmAddressData } from 'components/Form/SelectBoxXlmAddresses/selectors'
import { last, lift, negate, nth, prop } from 'ramda'
import { OwnProps } from '.'
import { selectors } from 'data'
import BigNumber from 'bignumber.js'

export const getData = (state, ownProps: OwnProps) => {
  const { coin } = ownProps
  let addressDataR
  let balanceDataR
  let coinRatesR

  switch (coin) {
    case 'BTC':
      addressDataR = getBtcAddressData(state, { excludeLockbox: true })
      balanceDataR = balanceSelectors.getBtcBalance(state)
      coinRatesR = selectors.core.data.btc.getRates(state)
      break
    case 'BCH':
      addressDataR = getBchAddressData(state, { excludeLockbox: true })
      balanceDataR = balanceSelectors.getBchBalance(state)
      coinRatesR = selectors.core.data.bch.getRates(state)
      break
    case 'ETH':
      addressDataR = getEthAddressData(state, { excludeLockbox: true })
      balanceDataR = balanceSelectors.getEthBalance(state)
      coinRatesR = selectors.core.data.eth.getRates(state)
      break
    case 'PAX':
      addressDataR = getErc20AddressData(state, { coin: 'PAX' })
      balanceDataR = balanceSelectors.getPaxBalance(state)
      coinRatesR = selectors.core.data.eth.getErc20Rates(state, 'pax')
      break
    case 'XLM':
      addressDataR = getXlmAddressData(state, { excludeLockbox: true })
      balanceDataR = balanceSelectors.getXlmBalance(state)
      coinRatesR = selectors.core.data.xlm.getRates(state)
      break
    default:
      addressDataR = Remote.Success({ data: [] })
  }
  const priceIndexSeriesR = selectors.core.data.misc.getPriceIndexSeries(state)
  const currencyR = selectors.core.settings.getCurrency(state)

  const transform = (
    addressData,
    balanceData,
    coinRates,
    currency: keyof CurrenciesType,
    priceIndexSeries
  ) => {
    const { value } = Exchange.convertCoinToCoin({
      value: balanceData,
      coin,
      baseToStandard: true
    })
    const currentValue = Exchange.convertCoinToFiat(
      value,
      coin,
      currency,
      coinRates
    )
    // @ts-ignore
    let currentPrice = prop('price', last(priceIndexSeries))
    // @ts-ignore
    let yesterdayPrice = prop('price', nth(23, priceIndexSeries))
    const yesterdayValue = Exchange.convertCoinToFiat(value, coin, currency, {
      ...priceIndexSeries,
      [currency]: {
        last: yesterdayPrice
      }
    })

    const changePercentage =
      ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100
    const changeFiat =
      changePercentage <= 0
        ? negate(currentValue - yesterdayValue)
        : currentValue - yesterdayValue

    return {
      addressData,
      balanceData,
      currencySymbol: Exchange.getSymbol(currency),
      priceChangeFiat: changeFiat,
      priceChangePercentage: changePercentage
    }
  }

  return lift(transform)(
    addressDataR,
    balanceDataR,
    coinRatesR,
    currencyR,
    priceIndexSeriesR
  )
}
