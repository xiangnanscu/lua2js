local function snake_case_name(x, y)
  if x > 0 or y > 0 then
    return nil, string.format('error: x is %s and y is %s', x, y)
  else
    return x + y
  end
end
