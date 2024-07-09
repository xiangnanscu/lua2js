local x = [[`\`\\`]]
for i, e in ipairs(t) do
  print(i, e)
end
for i, e in ipairs(t) do
  print(e)
end
local a = dict({a=1}, b)
local a = list({1,2}, b)
print(a[1])
local a = {unpack(t)}
local function snake_case_name(x, y)
  if x > 0 or y > 0then
    return nil, string.format('error: x is %s and y is %s', x, y)
  else
    return x + y, x - y
  end
end
console.log(string.format("hello %s", world))
console.log(string.format([[hello:
  you are multiple line %s]], world))
type(x+1)
table.concat(t, ",")
table_concat(t, ",")
table_concat({1,2,3}, ",")
t[#t+1] = 1
table_insert(t,1,a)
table.insert(t,1,a)
table_insert(t, 1)
table.insert(t, 1)
local array = {1,2}
local dict = {a=1, b=2}
Test = class {
  a = {1, 2}
}
local function foo(x, y)
  return x + y
end
local c = {a=1}
function c.foo(x, y)
  return x + y
end
function c.foo(self, x, y)
  return x + y + self.n
end
function c:foo(x, y)
  return x + y + self.n
end
local TestClass = class {
  p1 = 'Hi class property p1',
  p2 = 'Hi class property p2',
  static_func = function(x, y)
    return x + y
  end,
  class_method = function(cls)
    cls:say_class_hi()
  end,
  say_class_hi = function(cls)
    console.log(cls.p1)
  end,
  instance_method = function(self)
    self:say_instance_hi()
  end,
  say_instance_hi = function(self)
    console.log(this.p2)
  end
}
