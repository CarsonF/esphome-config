import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import sensor

my_sensor_ns = cg.esphome_ns.namespace("my_sensor")
MySensor = my_sensor_ns.class_("MySensor", sensor.Sensor, cg.PollingComponent)

CONF_SCALE = "scale"
CONF_MODE = "mode"
CONF_CHANNEL = "channel"

CONFIG_SCHEMA = (
  sensor.sensor_schema(MySensor, accuracy_decimals=1)
  .extend(
    {
      cv.Required(CONF_CHANNEL): cv.int_range(min=0, max=7),
      cv.Optional(CONF_SCALE, default=1.0): cv.float_,
      cv.Optional(CONF_MODE, default="fast"): cv.one_of("fast", "slow", lower=True),
    }
  )
  .extend(cv.polling_component_schema("60s"))
)


async def to_code(config):
  var = await sensor.new_sensor(config)
  await cg.register_component(var, config)
  cg.add(var.set_scale(config[CONF_SCALE]))
