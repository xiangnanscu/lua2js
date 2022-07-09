#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
# echo 'www.example.com' > CNAME

git init
git checkout -b master
git add -A
git commit -m 'deploy'


# if you are deploying to https://<USERNAME>.github.io/<REPO>

if [ ! -z $USE_HTTPS ]; then
  echo "use https proto"
  git push -f https://github.com/xiangnanscu/lua2js.git master:gh-pages
else
  echo "use git proto"
  git push -f git@github.com:xiangnanscu/lua2js.git master:gh-pages
fi
cd -
yarn push


