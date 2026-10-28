##### Step 1. Create a GitHub repo
I don't think this will be a difficult step, but still...
1. Open [GitHub's home page](https://github.com)
2. Click on '+' button, and then click 'New repository'
![image](./public/readme/step1_2.png)
3. Enter repo's name and everything else if you want to (everything except name is not neccessary)
![image](./public/readme/step1_3.png)

##### Step 2. Create a fine-grained PAT
1. Click on your profile picture and open settings
![image](./public/readme/step2_1.png)
2. Scroll down to 'Developer settings'
![image](./public/readme/step2_2.png)
3. Click 'Personal access tokens' and select 'Fine-grained tokens'. Click generate new token. Confirm access if needed
![image](./public/readme/step2_3.png)
4. Enter token name, set expiration date, in 'Repository access' select 'Only select repositories' and select your repo from step 1. 
![image](./public/readme/step2_4-1.png)
![image](./public/readme/step2_4-2.png)
5. Add 'Contents' read-and-write permission and click 'Generate token'. Then click 'Generate token' again
![image](./public/readme/step2_5-1.png)
![image](./public/readme/step2_5-2.png)
![image](./public/readme/step2_5-3.png)
6. Copy token and store it in safe place, because you will never able to see it again
![image](./public/readme/step2_6.png)

##### Step 3. Setup GitHub integration in Vhordo
1. Open settings
![image](./public/readme/step3_1.png)
2. In 'GitHub' click 'Connect'
![image](./public/readme/step3_2.png)
3. Enter your repo's (step 1) name in OWNER/NAME format (for https://github.com/example/repo this will be example/repo etc.) and access token (step 2) and click OK
![image](./public/readme/step3_3.png)
4. if there's an error, check if you enter everything correctly

#### I hope that this guide is as clear as possible
 If not then sorry, I tried ;(
